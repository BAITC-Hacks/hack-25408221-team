import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import WebSocket, WebSocketDisconnect
from google.genai import types

from app.config import settings
from app.infrastructure.database import get_session
from app.infrastructure.repositories import SessionRepository
from app.interview.gemini_client import build_live_connect_config, get_genai_client

logger = logging.getLogger(__name__)

CHECK_IN_INTERVAL = settings.checkin_silence_interval_seconds
CHECK_IN_WAIT = settings.checkin_wait_seconds
MAX_CHECK_INS = settings.max_checkins

VALID_RECOMMENDATIONS = {
    "strongly_recommended",
    "recommended",
    "needs_review",
    "not_recommended",
}


def validate_end_session_args(args: dict) -> dict:
    """The Live API's function-calling schema (build_end_session_tool) declares
    these shapes, but a model response is never guaranteed to match its
    declared schema -- validate before writing to the DB instead of trusting
    it blindly. Raises ValueError on the first invalid/missing field."""
    applicant_notes = args.get("applicant_notes")
    if not isinstance(applicant_notes, dict):
        raise ValueError(f"applicant_notes missing or not an object: {applicant_notes!r}")

    overall_impression = args.get("overall_impression")
    if not isinstance(overall_impression, str) or not overall_impression.strip():
        raise ValueError(f"overall_impression missing or empty: {overall_impression!r}")

    recommendation = args.get("recommendation")
    if recommendation not in VALID_RECOMMENDATIONS:
        raise ValueError(f"recommendation not a recognized value: {recommendation!r}")

    overall_score = args.get("overall_score")
    if overall_score is not None and (
        not isinstance(overall_score, (int, float)) or not (1 <= overall_score <= 10)
    ):
        raise ValueError(f"overall_score not numeric in range 1-10: {overall_score!r}")

    strengths = args.get("strengths") or []
    if not isinstance(strengths, list) or not all(isinstance(s, str) for s in strengths):
        raise ValueError(f"strengths must be a list of strings: {strengths!r}")

    concerns = args.get("concerns") or []
    if not isinstance(concerns, list) or not all(isinstance(c, str) for c in concerns):
        raise ValueError(f"concerns must be a list of strings: {concerns!r}")

    return {
        "applicant_notes": applicant_notes,
        "overall_impression": overall_impression,
        "overall_score": overall_score,
        "recommendation": recommendation,
        "strengths": strengths,
        "concerns": concerns,
    }

# Tracks session_ids with an open live connection. Only safe because the app
# runs as a single uvicorn worker (see Dockerfile) -- state here is process-wide
# in-memory, not shared across workers/instances. Checked and updated with no
# `await` in between, so it's race-free under asyncio's cooperative scheduling.
_active_connections: set[str] = set()


async def run_interview_session(
    websocket: WebSocket, session_id: str, user_id: Optional[str]
) -> None:
    logger.info(f"Client connected for session {session_id} (user={user_id})")

    if session_id in _active_connections:
        await websocket.send_text(
            json.dumps(
                {
                    "type": "error",
                    "message": "This interview session already has an active connection",
                }
            )
        )
        await websocket.close(code=4008)
        return

    _active_connections.add(session_id)
    try:
        await _run_interview_session(websocket, session_id)
    finally:
        _active_connections.discard(session_id)


async def _run_interview_session(websocket: WebSocket, session_id: str) -> None:
    if not settings.gemini_api_key:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "GEMINI_API_KEY not set"})
        )
        await websocket.close()
        return

    client = get_genai_client()
    config = build_live_connect_config()

    transcript: List[dict] = []
    current_turn: Optional[dict] = None
    session_start = datetime.now(timezone.utc)
    # Marks the start of the current "waiting for the user" window: reset
    # whenever the user is confirmed to have spoken (input_transcription) and
    # whenever the agent finishes a turn (turn_complete) -- so silence is only
    # measured for the period where it's actually the user's turn to talk.
    last_activity = session_start
    # True while the agent's own audio is streaming to the client. The user
    # is expected to be listening, not talking, during this window, so the
    # silence monitor must not check in on them for it.
    agent_speaking = False
    check_in_count = 0
    session_ended = False
    evaluation_saved = False
    session_ended_event = asyncio.Event()
    silence_task = None

    def finalize_current_turn():
        nonlocal current_turn
        if current_turn is not None:
            transcript.append(current_turn)
            current_turn = None

    def append_turn_text(role: str, text: str) -> None:
        """Gemini streams transcription as fragments of the same turn, not one
        message per turn -- coalesce consecutive same-role fragments into a
        single transcript entry instead of one entry per fragment."""
        nonlocal current_turn
        if current_turn is not None and current_turn["role"] == role:
            current_turn["text"] += text
            return
        finalize_current_turn()
        current_turn = {
            "role": role,
            "text": text,
            "timestamp": (datetime.now(timezone.utc) - session_start).total_seconds(),
        }

    async def silence_monitor():
        nonlocal last_activity, check_in_count, session_ended
        while not session_ended:
            try:
                await asyncio.sleep(CHECK_IN_INTERVAL)
                if session_ended:
                    break
                if agent_speaking:
                    # It's the agent's turn to talk, not the user's -- silence
                    # from the user right now is expected, not inactivity.
                    continue
                silence_duration = (
                    datetime.now(timezone.utc) - last_activity
                ).total_seconds()
                if (
                    silence_duration >= CHECK_IN_INTERVAL
                    and check_in_count < MAX_CHECK_INS
                ):
                    check_in_count += 1
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "check_in",
                                "message": "Are you still there?",
                            }
                        )
                    )
                    logger.info(
                        f"Check-in {check_in_count}/{MAX_CHECK_INS} for session {session_id}"
                    )
                    await asyncio.sleep(CHECK_IN_WAIT)
                elif (
                    silence_duration >= CHECK_IN_INTERVAL
                    and check_in_count >= MAX_CHECK_INS
                ):
                    logger.info(f"Max check-ins reached, ending session {session_id}")
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "interview_ended",
                                "message": "No response detected. Your session has ended.",
                            }
                        )
                    )
                    session_ended = True
                    session_ended_event.set()
                    return
            except Exception:
                break

    async def dead_letter_evaluation(raw_args: dict, reason: str):
        """Best-effort: record why the evaluation couldn't be saved instead of
        silently dropping it, reusing the existing `evaluation` JSON column and
        `mark_incomplete` rather than adding new schema."""
        try:
            async for db_session in get_session():
                repo = SessionRepository(db_session)
                await repo.update_transcript(session_id, transcript)
                await repo.update_evaluation(
                    session_id,
                    {
                        "evaluation_save_failed": True,
                        "reason": reason,
                        "raw_args": raw_args,
                    },
                )
                await repo.mark_incomplete(session_id)
                logger.error(
                    f"Dead-lettered evaluation for session {session_id}: {reason}"
                )
                break
        except Exception as e:
            logger.error(
                f"Failed to dead-letter evaluation for session {session_id}: {e}",
                exc_info=True,
            )

    async def save_evaluation(args: dict) -> bool:
        nonlocal evaluation_saved
        try:
            validated = validate_end_session_args(args)
        except ValueError as e:
            logger.error(f"Invalid end_session args for {session_id}: {e}")
            await dead_letter_evaluation(args, f"invalid args: {e}")
            return False

        last_error: Optional[Exception] = None
        for attempt in range(1, settings.evaluation_save_max_attempts + 1):
            try:
                async for db_session in get_session():
                    repo = SessionRepository(db_session)
                    evaluation = {
                        "overall_impression": validated["overall_impression"],
                        "overall_score": validated["overall_score"],
                        "recommendation": validated["recommendation"],
                        "strengths": validated["strengths"],
                        "concerns": validated["concerns"],
                    }
                    existing_session = await repo.get_by_id(session_id)
                    existing_data = (
                        dict(existing_session.applicant_data or {})
                        if existing_session
                        else {}
                    )
                    existing_data.update(validated["applicant_notes"])
                    await repo.update_transcript(session_id, transcript)
                    await repo.update_applicant_data(session_id, existing_data)
                    await repo.update_evaluation(session_id, evaluation)
                    await repo.complete(session_id)
                    evaluation_saved = True
                    logger.info(f"Saved evaluation for session {session_id}")
                    return True
            except Exception as e:
                last_error = e
                logger.error(
                    f"Evaluation save attempt {attempt}/{settings.evaluation_save_max_attempts} "
                    f"failed for {session_id}: {e}"
                )
                if attempt < settings.evaluation_save_max_attempts:
                    await asyncio.sleep(settings.evaluation_save_retry_delay_seconds)

        await dead_letter_evaluation(
            args,
            f"db write failed after {settings.evaluation_save_max_attempts} attempts: {last_error}",
        )
        return False

    async def mark_incomplete():
        try:
            async for db_session in get_session():
                repo = SessionRepository(db_session)
                await repo.update_transcript(session_id, transcript)
                await repo.mark_incomplete(session_id)
                logger.info(
                    f"Marked session {session_id} incomplete "
                    f"({len(transcript)} transcript entries)"
                )
                break
        except Exception as e:
            logger.error(
                f"Failed to mark session incomplete for session {session_id}: {e}",
                exc_info=True,
            )

    try:
        async with client.aio.live.connect(
            model=settings.model, config=config
        ) as session:
            logger.info(f"Gemini Live session opened for session {session_id}")

            await websocket.send_text(
                json.dumps(
                    {
                        "type": "status",
                        "message": "Connected! Your video presentation session has started.",
                    }
                )
            )

            silence_task = asyncio.create_task(silence_monitor())

            async def forward_to_gemini():
                try:
                    async for data in websocket.iter_bytes():
                        # NOTE: this only proves audio bytes reached the server,
                        # not that the user said anything -- the browser streams
                        # continuously regardless of silence (see pcm-processor.js).
                        # Real speech evidence is handled in forward_from_gemini
                        # via input_transcription, using Gemini's own VAD.
                        await session.send_realtime_input(
                            audio=types.Blob(
                                data=data, mime_type="audio/pcm;rate=16000"
                            )
                        )
                except WebSocketDisconnect:
                    logger.info(f"Client disconnected (send path) for session {session_id}")

            async def forward_from_gemini():
                nonlocal session_ended, last_activity, agent_speaking, check_in_count
                try:
                    while True:
                        async for response in session.receive():
                            if response.server_content:
                                sc = response.server_content

                                if (
                                    sc.input_transcription
                                    and sc.input_transcription.text
                                ):
                                    append_turn_text(
                                        "user", sc.input_transcription.text
                                    )
                                    # Applicant's own words -- content, not just
                                    # metadata, so this stays out of default (INFO)
                                    # production logs.
                                    logger.debug(
                                        f"User [{session_id}]: {sc.input_transcription.text}"
                                    )
                                    # Confirmed evidence (Gemini's own VAD +
                                    # transcription) that the user just spoke.
                                    last_activity = datetime.now(timezone.utc)
                                    check_in_count = 0

                                if (
                                    sc.output_transcription
                                    and sc.output_transcription.text
                                ):
                                    append_turn_text(
                                        "assistant", sc.output_transcription.text
                                    )

                                if sc.turn_complete:
                                    finalize_current_turn()
                                    # Agent's turn just ended -- start a fresh
                                    # "waiting for the user" window from now.
                                    agent_speaking = False
                                    last_activity = datetime.now(timezone.utc)

                                if sc.model_turn:
                                    agent_speaking = True
                                    for part in sc.model_turn.parts:
                                        if part.inline_data and part.inline_data.data:
                                            await websocket.send_bytes(
                                                part.inline_data.data
                                            )
                                        elif part.text:
                                            logger.debug(
                                                f"Gemini [{session_id}]: {part.text}"
                                            )

                            if response.tool_call and response.tool_call.function_calls:
                                for call in response.tool_call.function_calls:
                                    if call.name == "end_session":
                                        logger.info(
                                            f"end_session called for {session_id}"
                                        )
                                        finalize_current_turn()
                                        args = call.args or {}
                                        saved = await save_evaluation(args)

                                        if saved:
                                            await websocket.send_text(
                                                json.dumps(
                                                    {
                                                        "type": "interview_ended",
                                                        "message": "Thank you! Your video presentation is now complete. You can end the session.",
                                                    }
                                                )
                                            )
                                        else:
                                            await websocket.send_text(
                                                json.dumps(
                                                    {
                                                        "type": "interview_ended",
                                                        "message": "Your session has ended, but we were unable to save your evaluation. Our team has been notified.",
                                                    }
                                                )
                                            )

                                        await session.send_tool_response(
                                            function_responses=[
                                                types.FunctionResponse(
                                                    id=call.id,
                                                    name="end_session",
                                                    response={
                                                        "status": "success" if saved else "error"
                                                    },
                                                )
                                            ]
                                        )

                                        session_ended = True
                                        session_ended_event.set()
                                        return

                except WebSocketDisconnect:
                    logger.info(
                        f"Client disconnected (receive path) for session {session_id}"
                    )
                except Exception as e:
                    logger.error(f"Gemini receive error for session {session_id}: {e}")

            t1 = asyncio.create_task(forward_to_gemini())
            t2 = asyncio.create_task(forward_from_gemini())

            done, pending = await asyncio.wait(
                [t1, t2],
                return_when=asyncio.FIRST_COMPLETED,
                timeout=settings.max_interview_duration,
            )

            if not done:
                logger.info(f"Presentation time limit reached for session {session_id}")
                try:
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "interview_ended",
                                "message": f"Presentation time limit ({settings.max_interview_duration // 60} min) reached.",
                            }
                        )
                    )
                except Exception:
                    pass

            session_ended = True
            session_ended_event.set()
            finalize_current_turn()

            if not evaluation_saved:
                await mark_incomplete()

            silence_task.cancel()
            for task in pending:
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass

    except WebSocketDisconnect:
        logger.info(
            f"WebSocket disconnected before session opened for session {session_id}"
        )
        finalize_current_turn()
        if not evaluation_saved:
            await mark_incomplete()
    except Exception as e:
        logger.error(f"Session error for session {session_id}: {e}", exc_info=True)
        finalize_current_turn()
        if not evaluation_saved:
            await mark_incomplete()
        try:
            await websocket.send_text(
                json.dumps({"type": "error", "message": "An internal error occurred"})
            )
        except Exception:
            pass
    finally:
        if silence_task:
            silence_task.cancel()
        logger.info(
            f"Connection closed for session {session_id}. "
            f"Transcript entries: {len(transcript)}"
        )
