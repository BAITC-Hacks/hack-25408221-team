from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


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
    created_at: datetime


class UserWithSession(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    has_recording: bool = False
    session: Optional[SessionResponse] = None
