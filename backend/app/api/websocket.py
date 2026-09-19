import json
from typing import Optional

from fastapi import APIRouter, Query, WebSocket

from app.core.security import decode_access_token
from app.interview.handler import run_interview_session

router = APIRouter(tags=["websocket"])


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

    await run_interview_session(
        websocket, session_id=session_id, user_id=payload.get("sub")
    )
