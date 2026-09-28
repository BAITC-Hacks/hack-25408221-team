from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from app.english.domain.enums import IeltsModule


class ApplicantCreate(BaseModel):
    external_id: str
    full_name: str
    email: str


class ApplicantOut(BaseModel):
    id: str
    external_id: str
    state: str
    placement: Optional[str] = None
    token: Optional[str] = None


class MeOut(BaseModel):
    id: str
    external_id: str
    state: str
    placement: Optional[str] = None
    placement_source: Optional[str] = None


class IeltsCheckIn(BaseModel):
    trf_number: str
    family_name: str
    date_of_birth: date
    test_date: date
    module: IeltsModule
    listening: float
    reading: float
    writing: float
    speaking: float
    overall: float


class IeltsCheckOut(BaseModel):
    id: str
    verdict: str
    reason: Optional[str] = None
    overall: float


class AdminLoginIn(BaseModel):
    email: str
    password: str


class AdminLoginOut(BaseModel):
    token: str


class AnswerIn(BaseModel):
    item_id: str
    answer: Any


class AnswersIn(BaseModel):
    answers: list[AnswerIn] = Field(max_length=20)


class CheckinIn(BaseModel):
    gates: dict[str, bool]
    consent: bool = False


class EventIn(BaseModel):
    seq: int = Field(ge=1)
    type: str = Field(min_length=1, max_length=64)
    section: Optional[Literal["listening", "reading", "writing", "speaking"]] = None
    ts_client: Optional[datetime] = None
    data: dict = {}


class EventsIn(BaseModel):
    events: list[EventIn] = Field(max_length=100)
    heartbeat: bool = False


class ReviewIn(BaseModel):
    session_id: Optional[str] = None
    ielts_check_id: Optional[str] = None
    decision: Literal["BACHELOR", "FOUNDATION", "retake"]
    note: Optional[str] = None
