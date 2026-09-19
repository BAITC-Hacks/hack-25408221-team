import asyncio
import json
import logging
from typing import List, Optional

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse, RedirectResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.core.auth import get_current_user
from app.core.security import decode_access_token
from app.domain.entities import SessionCreate
from app.infrastructure.database import get_session
from app.infrastructure.repositories import SessionRepository, UserRepository
from app.infrastructure.s3_client import s3_client
from app.use_cases.session_use_cases import (
    CreateSessionUseCase,
    GetSessionUseCase,
    UploadRecordingUseCase,
)
from app.use_cases.analyze_session_use_case import AnalyzeSessionUseCase
from app.ml.ai_detection import run_ai_detection

router = APIRouter(prefix="/api", tags=["sessions"])

MAX_UPLOAD_SIZE = settings.max_upload_size_mb * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"video/webm", "video/mp4", "audio/webm"}


def _get_create_session_use_case(db_session: AsyncSession = Depends(get_session)):
    return CreateSessionUseCase(SessionRepository(db_session))


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
    db_session: AsyncSession = Depends(get_session),
):
    user_id = payload.get("userId")
    program = payload.get("program")
    form_data = payload.get("formData", {})

    if not user_id:
        raise HTTPException(status_code=400, detail="userId is required")

    session_repo = SessionRepository(db_session)
    existing = await session_repo.get_by_user_id(user_id)

    if existing:
        merged = dict(existing.applicant_data or {})
        merged["form_data"] = form_data
        await session_repo.update_applicant_data(existing.id, merged)
        return {"ok": True, "sessionId": existing.id}

    if not program:
        raise HTTPException(status_code=400, detail="program is required")

    user_repo = UserRepository(db_session)
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    session_create = SessionCreate(user_id=user_id, program=program)
    use_case = CreateSessionUseCase(session_repo)
    new_session = await use_case.execute(session_create)
    await session_repo.update_applicant_data(new_session.id, {"form_data": form_data})
    return {"ok": True, "sessionId": new_session.id}


@router.post("/sessions")
async def create_session(
    payload: dict,
    current_user=Depends(get_current_user),
    db_session: AsyncSession = Depends(get_session),
):
    user_id = payload.get("userId")
    program = payload.get("program")

    if not user_id or user_id == "undefined":
        raise HTTPException(status_code=400, detail="userId is required")
    if not program:
        raise HTTPException(status_code=400, detail="program is required")

    user_repo = UserRepository(db_session)
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    session_repo = SessionRepository(db_session)
    existing = await session_repo.get_by_user_id(user_id)
    if existing and existing.completed_at:
        raise HTTPException(status_code=409, detail="Interview already completed. Only one submission is allowed.")

    session_create = SessionCreate(user_id=user_id, program=program)
    use_case = CreateSessionUseCase(session_repo)
    new_session = await use_case.execute(session_create)
    return {"sessionId": new_session.id}


@router.post("/upload-recording")
async def upload_recording(
    sessionId: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db_session: AsyncSession = Depends(get_session),
    use_case: UploadRecordingUseCase = Depends(_get_upload_recording_use_case),
):
    session_obj = await SessionRepository(db_session).get_by_id(sessionId)
    if not session_obj:
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
    transcript: List[dict],
    current_user=Depends(get_current_user),
    use_case: AnalyzeSessionUseCase = Depends(_get_analyze_use_case),
):
    result, error = await use_case.execute(session_id, transcript)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result


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

    fresh_url = await s3_client.get_presigned_url(session_obj.recording_url)
    return RedirectResponse(url=fresh_url)


@router.get("/recording-url/{session_id}")
async def get_recording_url(
    session_id: str,
    token: Optional[str] = Query(None),
    db_session: AsyncSession = Depends(get_session),
):
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    repo = SessionRepository(db_session)
    session_obj = await repo.get_by_id(session_id)
    if not session_obj or not session_obj.recording_url:
        raise HTTPException(status_code=404, detail="Recording not found")

    fresh_url = await s3_client.get_presigned_url(session_obj.recording_url)
    return {"url": fresh_url}


@router.post("/sessions/{session_id}/detect-ai")
async def detect_ai_in_session(
    session_id: str,
    current_user=Depends(get_current_user),
    db_session: AsyncSession = Depends(get_session),
):
    repo = SessionRepository(db_session)
    session_obj = await repo.get_by_id(session_id)
    if not session_obj:
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
    if not decode_access_token(token):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    full_path = Path("uploads") / file_path
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(str(full_path), media_type="video/webm")
