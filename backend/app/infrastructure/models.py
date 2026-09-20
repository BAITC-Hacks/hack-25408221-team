from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.domain.enums import RatingEventStatus, SessionStatus


def _utc_now() -> datetime:
    return datetime.utcnow()


class UserTable(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    phone: Optional[str] = None
    password: str
    role: str = Field(default="applicant")
    created_at: datetime = Field(default_factory=_utc_now)


class SessionTable(SQLModel, table=True):
    __tablename__ = "sessions"

    id: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    program: str
    recording_url: Optional[str] = None
    transcript: Optional[list] = Field(default=None, sa_column=Column(JSON))
    applicant_data: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    evaluation: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str = Field(default=SessionStatus.IN_PROGRESS.value)
    created_at: datetime = Field(default_factory=_utc_now)


class RatingEventTable(SQLModel, table=True):
    """A single (indicator, verbatim quote, band, rater) tuple -- never an
    aggregate score. Multiple rows per session per indicator form the
    distribution shown to the committee (SPEC Section 1/5). A human-decided
    row (status accepted/rejected, rater_type human) is durable: a later
    model proposal for the same indicator creates a new row rather than
    mutating it."""

    __tablename__ = "rating_events"

    id: str = Field(primary_key=True)
    session_id: str = Field(foreign_key="sessions.id", index=True)
    indicator: str = Field(index=True)
    quote: str
    band: str
    rater_type: str
    rater_id: Optional[str] = Field(default=None, foreign_key="users.id")
    status: str = Field(default=RatingEventStatus.PROPOSED.value)
    created_at: datetime = Field(default_factory=_utc_now)
