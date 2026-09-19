from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.domain.enums import SessionStatus


class User(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    password: str
    role: str = "applicant"
    created_at: Optional[datetime] = None


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    role: str = "applicant"
    created_at: Optional[datetime] = None


class UserCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    password: str
    role: str = "applicant"


class UserLogin(BaseModel):
    email: str
    password: str


class TranscriptEntry(BaseModel):
    """One coalesced turn from the live interview (see
    app/interview/handler.py's append_turn_text). Used to validate the
    request body of the one route that accepts a transcript from outside
    the server (POST /sessions/{id}/analyze) -- not used for
    Session.transcript itself, since that field flows untouched as raw
    dicts through the live-call hot path (handler.py) and several
    ML/admin consumers (app/ml/ai_detection.py, admin_routes.py,
    enhanced_analysis.py) that index it with dict access; retyping it
    there would ripple into those call sites for no behavior-preserving
    benefit."""

    role: str
    text: str
    timestamp: float


class Session(BaseModel):
    id: str
    user_id: str
    program: str
    recording_url: Optional[str] = None
    transcript: Optional[List[dict]] = None
    applicant_data: Optional[Dict[str, Any]] = None
    evaluation: Optional[Dict[str, Any]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str = SessionStatus.IN_PROGRESS.value
    created_at: datetime


class SessionCreate(BaseModel):
    user_id: str
    program: str


class SessionResponse(BaseModel):
    id: str
    user_id: str
    program: str
    recording_url: Optional[str] = None
    transcript: Optional[List[dict]] = None
    applicant_data: Optional[Dict[str, Any]] = None
    evaluation: Optional[Dict[str, Any]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str = SessionStatus.IN_PROGRESS.value
    created_at: datetime


class UserWithSession(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    has_recording: bool = False
    session: Optional[SessionResponse] = None
