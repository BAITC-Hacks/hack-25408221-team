import uuid
from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy import JSON, Column, String
from sqlmodel import Field, SQLModel


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


class Applicant(SQLModel, table=True):
    __tablename__ = "applicants"

    id: str = Field(default_factory=_uuid, primary_key=True)
    external_id: str = Field(unique=True, index=True)
    full_name: str
    email: str
    state: str = Field(default="new")
    placement: Optional[str] = Field(default=None)
    placement_source: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=_now)


class IeltsCheck(SQLModel, table=True):
    __tablename__ = "ielts_checks"

    id: str = Field(default_factory=_uuid, primary_key=True)
    applicant_id: str = Field(foreign_key="applicants.id", index=True)
    trf_number: str
    family_name: str
    date_of_birth: date
    test_date: date
    module: str
    listening: float
    reading: float
    writing: float
    speaking: float
    overall: float
    verdict: str
    reason: Optional[str] = Field(default=None)
    verifier_record: dict = Field(default_factory=dict, sa_column=Column(JSON))
    attempts: int = Field(default=0)
    checked_at: datetime = Field(default_factory=_now)


class Item(SQLModel, table=True):
    """Item bank entry. `content` holds every field the client may see;
    `key` holds server-only answer data and is never serialized to the client."""

    __tablename__ = "items"

    id: str = Field(primary_key=True)  # bank id, e.g. "L-B1-004"
    section: str = Field(sa_column=Column(String, nullable=False))
    type: str
    stage: str = Field(sa_column=Column(String, nullable=False))
    cefr: int
    content: dict = Field(default_factory=dict, sa_column=Column(JSON))
    key: dict = Field(default_factory=dict, sa_column=Column(JSON))
    media_path: Optional[str] = Field(default=None)
    exposure_count: int = Field(default=0)
    status: str = Field(default="draft")


class TestSession(SQLModel, table=True):
    __tablename__ = "test_sessions"

    id: str = Field(default_factory=_uuid, primary_key=True)
    applicant_id: str = Field(foreign_key="applicants.id", index=True)
    state: str = Field(default="created")
    form: dict = Field(default_factory=dict, sa_column=Column(JSON))
    current_section: Optional[str] = Field(default=None)
    section_started_at: dict = Field(default_factory=dict, sa_column=Column(JSON))
    section_deadline: dict = Field(default_factory=dict, sa_column=Column(JSON))
    route: dict = Field(default_factory=dict, sa_column=Column(JSON))
    screen_token_seed: str = Field(default_factory=lambda: uuid.uuid4().hex)
    levels: dict = Field(default_factory=dict, sa_column=Column(JSON))
    flags: dict = Field(default_factory=dict, sa_column=Column(JSON))
    placement: Optional[str] = Field(default=None)
    integrity_score: int = Field(default=0)
    integrity_level: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=_now)


class Response(SQLModel, table=True):
    __tablename__ = "responses"

    id: str = Field(default_factory=_uuid, primary_key=True)
    session_id: str = Field(foreign_key="test_sessions.id", index=True)
    item_id: str = Field(foreign_key="items.id")
    section: str = Field(sa_column=Column(String, nullable=False))
    stage: str = Field(sa_column=Column(String, nullable=False))
    answer: dict = Field(default_factory=dict, sa_column=Column(JSON))
    media_path: Optional[str] = Field(default=None)
    keystroke_log_path: Optional[str] = Field(default=None)
    correct: Optional[bool] = Field(default=None)
    grade: dict = Field(default_factory=dict, sa_column=Column(JSON))
    submitted_at: datetime = Field(default_factory=_now)


class Checkin(SQLModel, table=True):
    __tablename__ = "checkins"

    id: str = Field(default_factory=_uuid, primary_key=True)
    session_id: str = Field(foreign_key="test_sessions.id", unique=True, index=True)
    gates: dict = Field(default_factory=dict, sa_column=Column(JSON))
    consent_at: Optional[datetime] = Field(default=None)
    id_photo_path: Optional[str] = Field(default=None)
    selfie_path: Optional[str] = Field(default=None)
    room_scan_path: Optional[str] = Field(default=None)


class ProctorEvent(SQLModel, table=True):
    __tablename__ = "proctor_events"

    id: str = Field(default_factory=_uuid, primary_key=True)
    session_id: str = Field(foreign_key="test_sessions.id", index=True)
    seq: int
    type: str
    section: Optional[str] = Field(default=None)
    ts_client: Optional[datetime] = Field(default=None)
    ts_server: datetime = Field(default_factory=_now)
    data: dict = Field(default_factory=dict, sa_column=Column(JSON))
    evidence_path: Optional[str] = Field(default=None)


class Review(SQLModel, table=True):
    __tablename__ = "reviews"

    id: str = Field(default_factory=_uuid, primary_key=True)
    session_id: Optional[str] = Field(default=None, foreign_key="test_sessions.id")
    ielts_check_id: Optional[str] = Field(default=None, foreign_key="ielts_checks.id")
    reviewer: str
    decision: str
    note: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=_now)
