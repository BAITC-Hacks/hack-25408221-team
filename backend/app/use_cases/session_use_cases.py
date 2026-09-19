from typing import Any, Dict, Optional, Tuple

from app.domain.entities import Session, SessionCreate
from app.domain.interfaces import SessionRepositoryInterface, UserRepositoryInterface
from app.infrastructure.s3_client import S3Client


class CreateSessionUseCase:
    def __init__(self, session_repo: SessionRepositoryInterface):
        self.session_repo = session_repo

    async def execute(self, session_create: SessionCreate) -> Session:
        return await self.session_repo.create(session_create)


class SubmitApplicationUseCase:
    """POST /api/applications: create-or-update a session's applicant_data
    from a public application form. Returns (session_id, error, status_code)
    since the route needs to distinguish 400 (bad input) from 404 (unknown
    user) from a plain 200."""

    def __init__(
        self,
        session_repo: SessionRepositoryInterface,
        user_repo: UserRepositoryInterface,
        create_session_use_case: CreateSessionUseCase,
    ):
        self.session_repo = session_repo
        self.user_repo = user_repo
        self.create_session_use_case = create_session_use_case

    async def execute(
        self, user_id: Optional[str], program: Optional[str], form_data: Dict[str, Any]
    ) -> Tuple[Optional[str], Optional[str], int]:
        if not user_id:
            return None, "userId is required", 400

        existing = await self.session_repo.get_by_user_id(user_id)
        if existing:
            merged = dict(existing.applicant_data or {})
            merged["form_data"] = form_data
            await self.session_repo.update_applicant_data(existing.id, merged)
            return existing.id, None, 200

        if not program:
            return None, "program is required", 400

        user = await self.user_repo.get_by_id(user_id)
        if not user:
            return None, "User not found", 404

        new_session = await self.create_session_use_case.execute(
            SessionCreate(user_id=user_id, program=program)
        )
        await self.session_repo.update_applicant_data(
            new_session.id, {"form_data": form_data}
        )
        return new_session.id, None, 200


class StartSessionUseCase:
    """POST /api/sessions: create a fresh interview session for a user, or
    reject with the specific status code the frontend already branches on
    (400 missing fields, 404 unknown user, 409 already completed)."""

    def __init__(
        self,
        session_repo: SessionRepositoryInterface,
        user_repo: UserRepositoryInterface,
        create_session_use_case: CreateSessionUseCase,
    ):
        self.session_repo = session_repo
        self.user_repo = user_repo
        self.create_session_use_case = create_session_use_case

    async def execute(
        self, user_id: Optional[str], program: Optional[str]
    ) -> Tuple[Optional[Session], Optional[str], int]:
        if not user_id or user_id == "undefined":
            return None, "userId is required", 400
        if not program:
            return None, "program is required", 400

        user = await self.user_repo.get_by_id(user_id)
        if not user:
            return None, "User not found", 404

        existing = await self.session_repo.get_by_user_id(user_id)
        if existing and existing.completed_at:
            return (
                None,
                "Interview already completed. Only one submission is allowed.",
                409,
            )

        new_session = await self.create_session_use_case.execute(
            SessionCreate(user_id=user_id, program=program)
        )
        return new_session, None, 200


class UploadRecordingUseCase:
    def __init__(
        self,
        session_repo: SessionRepositoryInterface,
        s3_client: S3Client,
    ):
        self.session_repo = session_repo
        self.s3_client = s3_client

    async def execute(
        self,
        session_id: str,
        file_content: bytes,
        filename: str,
    ) -> Tuple[Optional[Session], Optional[str]]:
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            return None, "Session not found"

        # Deterministic per-session key -- re-uploading (retry after a
        # network blip, or a legitimate re-submit) overwrites in place
        # instead of erroring, so the client can safely retry.
        file_key = f"recordings/{session_id}/{filename}"
        await self.s3_client.upload_file(
            file_key=file_key,
            file_content=file_content,
            content_type="video/webm",
        )

        session = await self.session_repo.update_recording(session_id, file_key)
        return session, None


class GetSessionUseCase:
    def __init__(self, session_repo: SessionRepositoryInterface):
        self.session_repo = session_repo

    async def execute(self, session_id: str) -> Tuple[Optional[Session], Optional[str]]:
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            return None, "Session not found"
        return session, None


class CompleteSessionUseCase:
    def __init__(self, session_repo: SessionRepositoryInterface):
        self.session_repo = session_repo

    async def execute(self, session_id: str) -> Session:
        return await self.session_repo.complete(session_id)
