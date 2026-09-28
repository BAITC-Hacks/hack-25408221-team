from typing import List, Optional, Tuple

from app.core.security import verify_password
from app.domain.entities import (
    Session,
    SessionResponse,
    User,
    UserCreate,
    UserLogin,
    UserWithSession,
)
from app.domain.interfaces import SessionRepositoryInterface, UserRepositoryInterface


def _to_session_response(session: Session) -> SessionResponse:
    return SessionResponse(
        id=session.id,
        user_id=session.user_id,
        program=session.program,
        recording_url=session.recording_url,
        transcript=session.transcript,
        applicant_data=session.applicant_data,
        evaluation=session.evaluation,
        started_at=session.started_at,
        completed_at=session.completed_at,
        status=session.status,
        created_at=session.created_at,
    )


class RegisterUserUseCase:
    def __init__(self, user_repo: UserRepositoryInterface):
        self.user_repo = user_repo

    async def execute(self, user_create: UserCreate) -> Tuple[User, Optional[str]]:
        existing = await self.user_repo.get_by_email(user_create.email)
        if existing:
            return None, "Email already registered"
        user = await self.user_repo.create(user_create)
        return user, None


class LoginUserUseCase:
    def __init__(self, user_repo: UserRepositoryInterface):
        self.user_repo = user_repo

    async def execute(self, login: UserLogin) -> Tuple[Optional[User], Optional[str]]:
        user = await self.user_repo.get_by_email(login.email)
        if not user or not verify_password(login.password, user.password):
            return None, "Invalid email or password"
        return user, None


class GetUserUseCase:
    def __init__(
        self,
        user_repo: UserRepositoryInterface,
        session_repo: SessionRepositoryInterface,
    ):
        self.user_repo = user_repo
        self.session_repo = session_repo

    async def execute(
        self, user_id: str
    ) -> Tuple[Optional[UserWithSession], Optional[str]]:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            return None, "User not found"

        session = await self.session_repo.get_by_user_id(user_id)
        session_response = None
        has_recording = False

        if session:
            has_recording = session.recording_url is not None
            session_response = _to_session_response(session)

        return UserWithSession(
            id=user.id,
            name=user.name,
            email=user.email,
            phone=user.phone,
            role=user.role,
            has_recording=has_recording,
            session=session_response,
        ), None


class ListUsersUseCase:
    def __init__(
        self,
        user_repo: UserRepositoryInterface,
        session_repo: SessionRepositoryInterface,
    ):
        self.user_repo = user_repo
        self.session_repo = session_repo

    async def execute(self) -> List[UserWithSession]:
        users = await self.user_repo.list_all()
        result = []

        for user in users:
            if user.role == "admin":
                continue
            session = await self.session_repo.get_by_user_id(user.id)
            has_recording = session.recording_url is not None if session else False
            session_response = _to_session_response(session) if session else None
            result.append(
                UserWithSession(
                    id=user.id,
                    name=user.name,
                    email=user.email,
                    phone=user.phone,
                    role=user.role,
                    has_recording=has_recording,
                    session=session_response,
                )
            )

        return result
