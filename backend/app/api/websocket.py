import json
from typing import Optional

from fastapi import APIRouter, Query, WebSocket

from app.core.security import decode_access_token
from app.infrastructure.database import get_session
from app.infrastructure.repositories import SessionRepository
from app.interview.handler import run_interview_session

router = APIRouter(tags=["websocket"])


async def _reject(websocket: WebSocket, message: str, code: int) -> None:
    await websocket.send_text(json.dumps({"type": "error", "message": message}))
    await websocket.close(code=code)


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: Optional[str] = Query(None),
):
    await websocket.accept()

    if not token:
        await _reject(websocket, "Authentication required", 4001)
        return

    payload = decode_access_token(token)
    if not payload:
        await _reject(websocket, "Invalid or expired token", 4001)
        return

    user_id = payload.get("sub")

    db_session_gen = get_session()
    db_session = await anext(db_session_gen)
    try:
        session = await SessionRepository(db_session).get_by_id(session_id)
    finally:
        await db_session_gen.aclose()

    if not session:
        await _reject(websocket, "Session not found", 4004)
        return
    if session.user_id != user_id:
        await _reject(websocket, "You do not have access to this session", 4003)
        return
    if session.completed_at is not None:
        await _reject(websocket, "This interview has already been completed", 4009)
        return

    await run_interview_session(websocket, session_id=session_id, user_id=user_id)
