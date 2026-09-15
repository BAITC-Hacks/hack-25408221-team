from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


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
    created_at: datetime = Field(default_factory=_utc_now)
