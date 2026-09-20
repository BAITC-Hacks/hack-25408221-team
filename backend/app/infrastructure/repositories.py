import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import desc
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import hash_password
from app.domain.entities import (
    RatingEvent,
    RatingEventCreate,
    Session,
    SessionCreate,
    User,
    UserCreate,
)
from app.domain.enums import RaterType, SessionStatus
from app.domain.interfaces import (
    RatingEventRepositoryInterface,
    SessionRepositoryInterface,
    UserRepositoryInterface,
)
from app.infrastructure.models import RatingEventTable, SessionTable, UserTable


def _to_user(db_user: UserTable) -> User:
    return User(
        id=db_user.id,
        name=db_user.name,
        email=db_user.email,
        phone=db_user.phone,
        password=db_user.password,
        role=db_user.role,
        created_at=db_user.created_at,
    )


def _to_rating_event(db_event: RatingEventTable) -> RatingEvent:
    return RatingEvent(
        id=db_event.id,
        session_id=db_event.session_id,
        indicator=db_event.indicator,
        quote=db_event.quote,
        band=db_event.band,
        rater_type=db_event.rater_type,
        rater_id=db_event.rater_id,
        status=db_event.status,
        created_at=db_event.created_at,
    )


def _to_session(db_session: SessionTable) -> Session:
    return Session(
        id=db_session.id,
        user_id=db_session.user_id,
        program=db_session.program,
        recording_url=db_session.recording_url,
        transcript=db_session.transcript,
        applicant_data=db_session.applicant_data,
        evaluation=db_session.evaluation,
        started_at=db_session.started_at,
        completed_at=db_session.completed_at,
        status=db_session.status,
        created_at=db_session.created_at,
    )


class UserRepository(UserRepositoryInterface):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user: UserCreate) -> User:
        db_user = UserTable(
            id=str(uuid.uuid4()),
            name=user.name,
            email=user.email,
            phone=user.phone,
            password=hash_password(user.password),
            role=user.role,
        )
        self.session.add(db_user)
        await self.session.commit()
        await self.session.refresh(db_user)
        return _to_user(db_user)

    async def get_by_id(self, user_id: str) -> Optional[User]:
        result = await self.session.execute(
            select(UserTable).where(UserTable.id == user_id)
        )
        db_user = result.scalars().first()
        return _to_user(db_user) if db_user else None

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(
            select(UserTable).where(UserTable.email == email)
        )
        db_user = result.scalars().first()
        return _to_user(db_user) if db_user else None

    async def list_all(self) -> List[User]:
        result = await self.session.execute(select(UserTable))
        return [_to_user(u) for u in result.scalars().all()]


class SessionRepository(SessionRepositoryInterface):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, session_create: SessionCreate) -> Session:
        db_session = SessionTable(
            id=str(uuid.uuid4()),
            user_id=session_create.user_id,
            program=session_create.program,
        )
        self.session.add(db_session)
        await self.session.commit()
        await self.session.refresh(db_session)
        return _to_session(db_session)

    async def get_by_id(self, session_id: str) -> Optional[Session]:
        result = await self.session.execute(
            select(SessionTable).where(SessionTable.id == session_id)
        )
        db_session = result.scalars().first()
        return _to_session(db_session) if db_session else None

    async def get_by_user_id(self, user_id: str) -> Optional[Session]:
        result = await self.session.execute(
            select(SessionTable)
            .where(SessionTable.user_id == user_id)
            .order_by(desc(SessionTable.created_at))
        )
        db_session = result.scalars().first()
        return _to_session(db_session) if db_session else None

    async def list_all(self) -> List[Session]:
        result = await self.session.execute(select(SessionTable))
        return [_to_session(s) for s in result.scalars().all()]

    async def update_recording(self, session_id: str, recording_url: str) -> Session:
        result = await self.session.execute(
            select(SessionTable).where(SessionTable.id == session_id)
        )
        db_session = result.scalars().first()
        if not db_session:
            raise ValueError(f"Session {session_id} not found")
        db_session.recording_url = recording_url
        self.session.add(db_session)
        await self.session.commit()
        await self.session.refresh(db_session)
        return _to_session(db_session)

    async def update_transcript(self, session_id: str, transcript: list) -> Session:
        result = await self.session.execute(
            select(SessionTable).where(SessionTable.id == session_id)
        )
        db_session = result.scalars().first()
        if not db_session:
            raise ValueError(f"Session {session_id} not found")
        db_session.transcript = transcript
        self.session.add(db_session)
        await self.session.commit()
        await self.session.refresh(db_session)
        return _to_session(db_session)

    async def update_applicant_data(
        self, session_id: str, applicant_data: dict
    ) -> Session:
        result = await self.session.execute(
            select(SessionTable).where(SessionTable.id == session_id)
        )
        db_session = result.scalars().first()
        if not db_session:
            raise ValueError(f"Session {session_id} not found")
        db_session.applicant_data = applicant_data
        self.session.add(db_session)
        await self.session.commit()
        await self.session.refresh(db_session)
        return _to_session(db_session)

    async def update_evaluation(self, session_id: str, evaluation: dict) -> Session:
        result = await self.session.execute(
            select(SessionTable).where(SessionTable.id == session_id)
        )
        db_session = result.scalars().first()
        if not db_session:
            raise ValueError(f"Session {session_id} not found")
        db_session.evaluation = evaluation
        self.session.add(db_session)
        await self.session.commit()
        await self.session.refresh(db_session)
        return _to_session(db_session)

    async def update_override(self, session_id: str, override_data: dict) -> Session:
        result = await self.session.execute(
            select(SessionTable).where(SessionTable.id == session_id)
        )
        db_session = result.scalars().first()
        if not db_session:
            raise ValueError(f"Session {session_id} not found")
        current_eval = dict(db_session.evaluation or {})
        current_eval["human_override"] = override_data
        db_session.evaluation = current_eval
        self.session.add(db_session)
        await self.session.commit()
        await self.session.refresh(db_session)
        return _to_session(db_session)

    async def update_feedback(self, session_id: str, feedback_data: dict) -> Session:
        result = await self.session.execute(
            select(SessionTable).where(SessionTable.id == session_id)
        )
        db_session = result.scalars().first()
        if not db_session:
            raise ValueError(f"Session {session_id} not found")
        current_eval = dict(db_session.evaluation or {})
        current_eval["admin_feedback"] = feedback_data
        db_session.evaluation = current_eval
        self.session.add(db_session)
        await self.session.commit()
        await self.session.refresh(db_session)
        return _to_session(db_session)

    async def complete(self, session_id: str) -> Session:
        result = await self.session.execute(
            select(SessionTable).where(SessionTable.id == session_id)
        )
        db_session = result.scalars().first()
        if not db_session:
            raise ValueError(f"Session {session_id} not found")
        db_session.completed_at = datetime.utcnow()
        db_session.status = SessionStatus.COMPLETED.value
        self.session.add(db_session)
        await self.session.commit()
        await self.session.refresh(db_session)
        return _to_session(db_session)

    async def mark_incomplete(self, session_id: str) -> Session:
        result = await self.session.execute(
            select(SessionTable).where(SessionTable.id == session_id)
        )
        db_session = result.scalars().first()
        if not db_session:
            raise ValueError(f"Session {session_id} not found")
        db_session.status = SessionStatus.INCOMPLETE.value
        self.session.add(db_session)
        await self.session.commit()
        await self.session.refresh(db_session)
        return _to_session(db_session)


class RatingEventRepository(RatingEventRepositoryInterface):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, rating_event: RatingEventCreate) -> RatingEvent:
        db_event = RatingEventTable(
            id=str(uuid.uuid4()),
            session_id=rating_event.session_id,
            indicator=rating_event.indicator,
            quote=rating_event.quote,
            band=rating_event.band,
            rater_type=rating_event.rater_type,
            rater_id=rating_event.rater_id,
        )
        self.session.add(db_event)
        await self.session.commit()
        await self.session.refresh(db_event)
        return _to_rating_event(db_event)

    async def list_by_session(self, session_id: str) -> List[RatingEvent]:
        result = await self.session.execute(
            select(RatingEventTable)
            .where(RatingEventTable.session_id == session_id)
            .order_by(RatingEventTable.created_at)
        )
        return [_to_rating_event(e) for e in result.scalars().all()]

    async def get_by_id(self, event_id: str) -> Optional[RatingEvent]:
        result = await self.session.execute(
            select(RatingEventTable).where(RatingEventTable.id == event_id)
        )
        db_event = result.scalars().first()
        return _to_rating_event(db_event) if db_event else None

    async def update_status(
        self,
        event_id: str,
        status: str,
        rater_id: Optional[str] = None,
        band: Optional[str] = None,
        quote: Optional[str] = None,
    ) -> RatingEvent:
        result = await self.session.execute(
            select(RatingEventTable).where(RatingEventTable.id == event_id)
        )
        db_event = result.scalars().first()
        if not db_event:
            raise ValueError(f"Rating event {event_id} not found")
        db_event.status = status
        if rater_id is not None:
            db_event.rater_id = rater_id
            db_event.rater_type = RaterType.HUMAN.value
        if band is not None:
            db_event.band = band
        if quote is not None:
            db_event.quote = quote
        self.session.add(db_event)
        await self.session.commit()
        await self.session.refresh(db_event)
        return _to_rating_event(db_event)
