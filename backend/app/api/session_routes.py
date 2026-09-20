import asyncio
import json
import logging
from typing import List, Optional

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, Query
from fastapi.responses import FileResponse, RedirectResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.user_routes import limiter
from app.config import settings
from app.core.auth import get_current_user
from app.core.security import decode_access_token
from app.domain.entities import TranscriptEntry
from app.infrastructure.database import get_session
from app.infrastructure.repositories import SessionRepository, UserRepository
from app.infrastructure import s3_client as s3_client_module
from app.infrastructure.s3_client import s3_client
from app.use_cases.session_use_cases import (
    CreateSessionUseCase,
    GetSessionUseCase,
    StartSessionUseCase,
    SubmitApplicationUseCase,
    UploadRecordingUseCase,
)
from app.use_cases.analyze_session_use_case import AnalyzeSessionUseCase
from app.ml.ai_detection import run_ai_detection

router = APIRouter(prefix="/api", tags=["sessions"])

MAX_UPLOAD_SIZE = settings.max_upload_size_mb * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"video/webm", "video/mp4", "audio/webm"}


def _get_submit_application_use_case(db_session: AsyncSession = Depends(get_session)):
    session_repo = SessionRepository(db_session)
    return SubmitApplicationUseCase(
        session_repo=session_repo,
        user_repo=UserRepository(db_session),
        create_session_use_case=CreateSessionUseCase(session_repo),
    )


def _get_start_session_use_case(db_session: AsyncSession = Depends(get_session)):
    session_repo = SessionRepository(db_session)
    return StartSessionUseCase(
        session_repo=session_repo,
        user_repo=UserRepository(db_session),
        create_session_use_case=CreateSessionUseCase(session_repo),
    )


def _get_upload_recording_use_case(db_session: AsyncSession = Depends(get_session)):
    return UploadRecordingUseCase(
        session_repo=SessionRepository(db_session),
        s3_client=s3_client,
    )


def _get_get_session_use_case(db_session: AsyncSession = Depends(get_session)):
    return GetSessionUseCase(SessionRepository(db_session))


def _get_analyze_use_case(db_session: AsyncSession = Depends(get_session)):
    return AnalyzeSessionUseCase(SessionRepository(db_session))


@router.post("/applications")
async def submit_application(
    payload: dict,
    current_user=Depends(get_current_user),
    use_case: SubmitApplicationUseCase = Depends(_get_submit_application_use_case),
):
    session_id, error, status_code = await use_case.execute(
        user_id=payload.get("userId"),
        program=payload.get("program"),
        form_data=payload.get("formData", {}),
    )
    if error:
        raise HTTPException(status_code=status_code, detail=error)
    return {"ok": True, "sessionId": session_id}


@router.post("/sessions")
@limiter.limit("10/minute")
async def create_session(
    request: Request,
    payload: dict,
    current_user=Depends(get_current_user),
    use_case: StartSessionUseCase = Depends(_get_start_session_use_case),
):
    new_session, error, status_code = await use_case.execute(
        user_id=payload.get("userId"), program=payload.get("program")
    )
    if error:
        raise HTTPException(status_code=status_code, detail=error)
    return {
        "sessionId": new_session.id,
        "maxDurationSecs": settings.max_interview_duration,
    }


@router.post("/upload-recording")
async def upload_recording(
    sessionId: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    get_session_use_case: GetSessionUseCase = Depends(_get_get_session_use_case),
    use_case: UploadRecordingUseCase = Depends(_get_upload_recording_use_case),
):
    session_obj, error = await get_session_use_case.execute(sessionId)
    if error or not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    if session_obj.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="You do not have access to this session"
        )

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}",
        )

    file_content = await file.read()
    if len(file_content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {settings.max_upload_size_mb}MB",
        )

    filename = f"{sessionId}.webm"

    updated_session, error = await use_case.execute(
        session_id=sessionId, file_content=file_content, filename=filename
    )

    if error:
        raise HTTPException(status_code=404, detail=error)

    file_key = updated_session.recording_url
    fresh_url = await s3_client.get_presigned_url(file_key)
    return {"ok": True, "file": filename, "url": fresh_url}


@router.post("/sessions/{session_id}/analyze")
async def analyze_session(
    session_id: str,
    transcript: List[TranscriptEntry],
    current_user=Depends(get_current_user),
    use_case: AnalyzeSessionUseCase = Depends(_get_analyze_use_case),
):
    result, error = await use_case.execute(
        session_id, [entry.model_dump() for entry in transcript]
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result


def _ensure_owner_or_admin(owner_user_id: Optional[str], role: Optional[str], user_id: Optional[str]) -> None:
    """Both /recording and /recording-url expose another applicant's presigned
    URL if not checked -- session_id alone is guessable/enumerable."""
    if role == "admin":
        return
    if owner_user_id is not None and owner_user_id == user_id:
        return
    raise HTTPException(status_code=403, detail="You do not have access to this session")


@router.get("/recording/{session_id}")
async def get_recording(
    session_id: str,
    token: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    use_case: GetSessionUseCase = Depends(_get_get_session_use_case),
):
    session_obj, error = await use_case.execute(session_id)
    if error or not session_obj or not session_obj.recording_url:
        raise HTTPException(status_code=404, detail="Recording not found")
    _ensure_owner_or_admin(session_obj.user_id, current_user.role, current_user.id)

    fresh_url = await s3_client.get_presigned_url(session_obj.recording_url)
    return RedirectResponse(url=fresh_url)


@router.get("/recording-url/{session_id}")
async def get_recording_url(
    session_id: str,
    token: Optional[str] = Query(None),
    use_case: GetSessionUseCase = Depends(_get_get_session_use_case),
    db_session: AsyncSession = Depends(get_session),
):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # This route can't use the get_current_user dependency (it's hit as a
    # plain URL, e.g. redirect target, that carries the token as a query
    # param instead of an Authorization header) -- look the user up manually.
    requesting_user = await UserRepository(db_session).get_by_id(payload.get("sub"))
    if not requesting_user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    session_obj, error = await use_case.execute(session_id)
    if error or not session_obj or not session_obj.recording_url:
        raise HTTPException(status_code=404, detail="Recording not found")
    _ensure_owner_or_admin(session_obj.user_id, requesting_user.role, requesting_user.id)

    fresh_url = await s3_client.get_presigned_url(session_obj.recording_url)
    return {"url": fresh_url}


@router.post("/sessions/{session_id}/detect-ai")
async def detect_ai_in_session(
    session_id: str,
    current_user=Depends(get_current_user),
    use_case: GetSessionUseCase = Depends(_get_get_session_use_case),
):
    session_obj, error = await use_case.execute(session_id)
    if error or not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session_obj.transcript:
        raise HTTPException(status_code=422, detail="Session has no transcript yet")

    result = run_ai_detection(session_obj.transcript, settings.sapling_api_key)

    if result.get("error"):
        raise HTTPException(status_code=502, detail=result["error"])

    return result


@router.get("/uploads/{file_path:path}")
async def serve_local_upload(
    file_path: str,
    token: Optional[str] = Query(None),
    db_session: AsyncSession = Depends(get_session),
):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    requesting_user = await UserRepository(db_session).get_by_id(payload.get("sub"))
    if not requesting_user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Read _LOCAL_DIR from the module at request time rather than caching a
    # resolved constant at import time -- tests monkeypatch this global to
    # keep uploads out of the repo's real ./uploads/ directory, and it must
    # stay the same base dir upload_file/get_presigned_url just wrote/served.
    uploads_base_dir = s3_client_module._LOCAL_DIR.resolve()
    full_path = (uploads_base_dir / file_path).resolve()
    if not full_path.is_relative_to(uploads_base_dir):
        raise HTTPException(status_code=404, detail="File not found")
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # Uploads are keyed as "recordings/{session_id}/{filename}" (see
    # UploadRecordingUseCase) -- recover the owning session from that shape
    # so a valid token only grants access to the caller's own recordings.
    parts = file_path.split("/")
    owner_session = None
    if len(parts) >= 2 and parts[0] == "recordings":
        owner_session = await SessionRepository(db_session).get_by_id(parts[1])
    if requesting_user.role != "admin":
        if owner_session is None or owner_session.user_id != requesting_user.id:
            raise HTTPException(status_code=403, detail="You do not have access to this file")

    return FileResponse(str(full_path), media_type="video/webm")
