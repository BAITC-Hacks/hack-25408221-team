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
    last_user_speech = session_start
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
        nonlocal last_user_speech, check_in_count, session_ended
        while not session_ended:
            try:
                await asyncio.sleep(CHECK_IN_INTERVAL)
                if session_ended:
                    break
                silence_duration = (
                    datetime.now(timezone.utc) - last_user_speech
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
                    logger.info(f"Check-in {check_in_count}/{MAX_CHECK_INS}")
                    await asyncio.sleep(CHECK_IN_WAIT)
                elif (
                    silence_duration >= CHECK_IN_INTERVAL
                    and check_in_count >= MAX_CHECK_INS
                ):
                    logger.info("Max check-ins reached, ending session")
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

    async def save_evaluation(args: dict):
        nonlocal evaluation_saved
        try:
            async for db_session in get_session():
                repo = SessionRepository(db_session)
                applicant_notes = args.get("applicant_notes", {})
                evaluation = {
                    "overall_impression": args.get("overall_impression", ""),
                    "overall_score": args.get("overall_score"),
                    "recommendation": args.get("recommendation", ""),
                    "strengths": args.get("strengths", []),
                    "concerns": args.get("concerns", []),
                }
                existing_session = await repo.get_by_id(session_id)
                existing_data = (
                    dict(existing_session.applicant_data or {})
                    if existing_session
                    else {}
                )
                existing_data.update(applicant_notes)
                await repo.update_transcript(session_id, transcript)
                await repo.update_applicant_data(session_id, existing_data)
                await repo.update_evaluation(session_id, evaluation)
                await repo.complete(session_id)
                evaluation_saved = True
                logger.info(f"Saved evaluation for session {session_id}")
                break
        except Exception as e:
            logger.error(f"Failed to save evaluation: {e}", exc_info=True)

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
            logger.error(f"Failed to mark session incomplete: {e}", exc_info=True)

    try:
        async with client.aio.live.connect(
            model=settings.model, config=config
        ) as session:
            logger.info("Gemini Live session opened")

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
                nonlocal last_user_speech, check_in_count
                try:
                    async for data in websocket.iter_bytes():
                        last_user_speech = datetime.now(timezone.utc)
                        check_in_count = 0
                        await session.send_realtime_input(
                            audio=types.Blob(
                                data=data, mime_type="audio/pcm;rate=16000"
                            )
                        )
                except WebSocketDisconnect:
                    logger.info("Client disconnected (send path)")

            async def forward_from_gemini():
                nonlocal session_ended
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
                                    logger.info(f"User: {sc.input_transcription.text}")

                                if (
                                    sc.output_transcription
                                    and sc.output_transcription.text
                                ):
                                    append_turn_text(
                                        "assistant", sc.output_transcription.text
                                    )

                                if sc.turn_complete:
                                    finalize_current_turn()

                                if sc.model_turn:
                                    for part in sc.model_turn.parts:
                                        if part.inline_data and part.inline_data.data:
                                            await websocket.send_bytes(
                                                part.inline_data.data
                                            )
                                        elif part.text:
                                            logger.info(f"Gemini: {part.text}")

                            if response.tool_call and response.tool_call.function_calls:
                                for call in response.tool_call.function_calls:
                                    if call.name == "end_session":
                                        logger.info(
                                            f"end_session called for {session_id}"
                                        )
                                        finalize_current_turn()
                                        args = call.args or {}
                                        await save_evaluation(args)

                                        await websocket.send_text(
                                            json.dumps(
                                                {
                                                    "type": "interview_ended",
                                                    "message": "Thank you! Your video presentation is now complete. You can end the session.",
                                                }
                                            )
                                        )

                                        await session.send_tool_response(
                                            function_responses=[
                                                types.FunctionResponse(
                                                    id=call.id,
                                                    name="end_session",
                                                    response={"status": "success"},
                                                )
                                            ]
                                        )

                                        session_ended = True
                                        session_ended_event.set()
                                        return

                except WebSocketDisconnect:
                    logger.info("Client disconnected (receive path)")
                except Exception as e:
                    logger.error(f"Gemini receive error: {e}")

            t1 = asyncio.create_task(forward_to_gemini())
            t2 = asyncio.create_task(forward_from_gemini())

            done, pending = await asyncio.wait(
                [t1, t2],
                return_when=asyncio.FIRST_COMPLETED,
                timeout=settings.max_interview_duration,
            )

            if not done:
                logger.info("Presentation time limit reached")
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
        logger.info("WebSocket disconnected before session opened")
        finalize_current_turn()
        if not evaluation_saved:
            await mark_incomplete()
    except Exception as e:
        logger.error(f"Session error: {e}", exc_info=True)
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
        logger.info(f"Connection closed. Transcript entries: {len(transcript)}")
