from typing import Optional, Tuple

from app.domain.entities import Session, SessionCreate
from app.domain.interfaces import SessionRepositoryInterface
from app.infrastructure.s3_client import S3Client


class CreateSessionUseCase:
    def __init__(self, session_repo: SessionRepositoryInterface):
        self.session_repo = session_repo

    async def execute(self, session_create: SessionCreate) -> Session:
        return await self.session_repo.create(session_create)


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

        if session.recording_url:
            return None, "Recording already uploaded for this session"

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
