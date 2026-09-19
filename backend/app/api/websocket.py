import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

from app.config import settings
from app.core.security import decode_access_token
from app.infrastructure.database import get_session
from app.infrastructure.repositories import SessionRepository

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

SYSTEM_INSTRUCTION = """You are a warm, friendly guide helping a university applicant record their video presentation for inVision University.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 0 — DISCOVERY (1 minute, 1-2 exchanges, informal)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Start with a single warm-up question to help the applicant feel comfortable.

Begin with: "Hi! Before we start, tell me briefly — what's one thing you're excited about right now?"

DISCOVERY RULES:
- ONE follow-up at most. Keep this under 1 minute total.
- Listen for specific details: names, places, projects.
- After 1-2 exchanges, transition immediately: "Great, let's move to the main part of your presentation."
- Use what you learned to make Phase 1 feel personal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — FORMAL PRESENTATION (5-6 minutes, 6 questions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Guide the applicant through these 6 questions in order:

1. Why are you applying to inVision U?
2. Which program are you applying to, and why did you choose it?
3. Tell me about a major challenge you overcame. What did you learn from it?
4. What are your long-term goals, and how will this program help you achieve them?
5. What does leadership mean to you? Give me a specific example of when you showed leadership.
6. Does your family support your decision to study here? Who encourages you most?

PRESENTATION STYLE:
- Warm, encouraging, not stressful. You are a guide, not an interrogator.
- After each answer, briefly acknowledge (1-2 sentences), then move to the next question.
- Do NOT ask follow-up questions — keep the presentation moving.
- Keep your responses concise (2-3 sentences max).
- Where natural, connect their Phase 0 context to the questions.
- After Question 6, warmly thank them and let them know their presentation is complete.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Speak in English by default, but if the applicant uses another language, adapt immediately.
- Never reveal that you are AI. Conduct this as a human guide would.
- Do not ask more than one question at a time.
- **IMMEDIATELY after the applicant answers Question 6, you MUST call the end_session function.** Do not add any conversational message after calling the function.
- If the applicant is unresponsive for an extended period, ask if they are still there. After two attempts with no response, call end_session.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATION TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Throughout both phases, observe and take notes on:
- Communication quality and confidence
- Authenticity: do they reference specific personal details or use generic phrases?
- Consistency: does what they say in Phase 1 align with what they shared in Phase 0?
- Motivation depth: specific and genuine, or vague and scripted?

You are writing notes for the admissions committee who will make the final decision.

**You MUST call end_session when Question 6 is answered. Do not wait.** Call it with:
- applicant_notes: their answers to each question (from Phase 1)
- overall_impression: a brief summary including any notable Phase 0 context
- overall_score: a numeric score from 1 to 10 reflecting overall suitability
- recommendation: your honest assessment
- strengths: top 2-3 strengths you observed across both phases
- concerns: any red flags or weak areas

Be honest and objective in your evaluation."""

CHECK_IN_INTERVAL = settings.checkin_silence_interval_seconds
CHECK_IN_WAIT = settings.checkin_wait_seconds
MAX_CHECK_INS = settings.max_checkins


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: Optional[str] = Query(None),
):
    await websocket.accept()

    if not token:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "Authentication required"})
        )
        await websocket.close(code=4001)
        return

    payload = decode_access_token(token)
    if not payload:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "Invalid or expired token"})
        )
        await websocket.close(code=4001)
        return

    logger.info(f"Client connected for session {session_id} (user={payload.get('sub')})")

    if not settings.gemini_api_key:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "GEMINI_API_KEY not set"})
        )
        await websocket.close()
        return

    client = genai.Client(
        api_key=settings.gemini_api_key, http_options={"api_version": "v1alpha"}
    )

    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Aoede")
            )
        ),
        system_instruction=SYSTEM_INSTRUCTION,
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=False,
                silence_duration_ms=1000,
                start_of_speech_sensitivity="START_SENSITIVITY_HIGH",
                end_of_speech_sensitivity="END_SENSITIVITY_HIGH",
            )
        ),
        proactivity=types.ProactivityConfig(),
        tools=[
            types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name="end_session",
                        description="Call when all 6 questions are complete or the applicant is unresponsive. Saves your evaluation and ends the interview.",
                        parameters=types.Schema(
                            type="object",
                            properties={
                                "applicant_notes": types.Schema(
                                    type="object",
                                    properties={
                                        "q1_why_applying": types.Schema(type="string"),
                                        "q2_program_choice": types.Schema(
                                            type="string"
                                        ),
                                        "q3_challenge_overcome": types.Schema(
                                            type="string"
                                        ),
                                        "q4_long_term_goals": types.Schema(
                                            type="string"
                                        ),
                                        "q5_leadership": types.Schema(type="string"),
                                        "q6_family_support": types.Schema(
                                            type="string"
                                        ),
                                        "language_used": types.Schema(type="string"),
                                        "confidence_level": types.Schema(
                                            type="string",
                                            enum=["high", "medium", "low"],
                                        ),
                                        "communication_quality": types.Schema(
                                            type="string",
                                            enum=[
                                                "excellent",
                                                "good",
                                                "average",
                                                "poor",
                                            ],
                                        ),
                                    },
                                ),
                                "overall_impression": types.Schema(
                                    type="string",
                                    description="Brief summary for the admissions committee",
                                ),
                                "overall_score": types.Schema(
                                    type="number",
                                    description="Overall score from 1 to 10",
                                ),
                                "recommendation": types.Schema(
                                    type="string",
                                    enum=[
                                        "strongly_recommended",
                                        "recommended",
                                        "needs_review",
                                        "not_recommended",
                                    ],
                                ),
                                "strengths": types.Schema(
                                    type="array",
                                    items=types.Schema(type="string"),
                                ),
                                "concerns": types.Schema(
                                    type="array",
                                    items=types.Schema(type="string"),
                                ),
                            },
                            required=[
                                "applicant_notes",
                                "overall_impression",
                                "recommendation",
                            ],
                        ),
                    )
                ]
            )
        ],
    )

    transcript: List[dict] = []
    session_start = datetime.now(timezone.utc)
    last_user_speech = session_start
    check_in_count = 0
    session_ended = False
    evaluation_saved = False
    session_ended_event = asyncio.Event()
    silence_task = None

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
                existing_data = dict(existing_session.applicant_data or {}) if existing_session else {}
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
                                    transcript.append(
                                        {
                                            "role": "user",
                                            "text": sc.input_transcription.text,
                                            "timestamp": (datetime.now(timezone.utc) - session_start).total_seconds(),
                                        }
                                    )
                                    logger.info(f"User: {sc.input_transcription.text}")

                                if (
                                    sc.output_transcription
                                    and sc.output_transcription.text
                                ):
                                    transcript.append(
                                        {
                                            "role": "assistant",
                                            "text": sc.output_transcription.text,
                                            "timestamp": (datetime.now(timezone.utc) - session_start).total_seconds(),
                                        }
                                    )

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

            if not evaluation_saved and transcript and len(transcript) > 0:
                await save_evaluation(
                    {
                        "applicant_notes": {
                            "session_completed": True,
                            "note": "Session ended without AI evaluation",
                        },
                        "overall_impression": "Interview completed but automatic evaluation was not triggered.",
                        "recommendation": "needs_review",
                        "strengths": [],
                        "concerns": [
                            "AI did not call end_session function - manual review required"
                        ],
                    }
                )

            silence_task.cancel()
            for task in pending:
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected before session opened")
    except Exception as e:
        logger.error(f"Session error: {e}", exc_info=True)
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
