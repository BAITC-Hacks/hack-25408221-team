import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.core.security import hash_password
from app.core.auth import require_admin
from app.domain.enums import RaterType, Recommendation, RatingBand, RatingEventStatus, RatingIndicator
from app.infrastructure.database import get_session
from app.infrastructure.models import UserTable
from app.infrastructure.repositories import (
    RatingEventRepository,
    SessionRepository,
    UserRepository,
)
from app.ml.scorer import CoreScorer
from app.ml.triage import compute_triage_queue
from app.use_cases.propose_rating_events_use_case import applicant_only_text
from app.use_cases.user_use_cases import GetUserUseCase, ListUsersUseCase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _get_list_users_use_case(db_session: AsyncSession = Depends(get_session)):
    return ListUsersUseCase(
        UserRepository(db_session),
        SessionRepository(db_session),
    )


def _get_get_user_use_case(db_session: AsyncSession = Depends(get_session)):
    return GetUserUseCase(
        UserRepository(db_session),
        SessionRepository(db_session),
    )


@router.post("/create-admin")
async def create_admin_account(
    payload: dict,
    db_session: AsyncSession = Depends(get_session),
):
    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "")
    name = payload.get("name", "Admin").strip()
    secret = payload.get("secret", "")

    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password required")

    if not settings.admin_creation_secret or secret != settings.admin_creation_secret:
        raise HTTPException(status_code=403, detail="Invalid admin creation secret")

    repo = UserRepository(db_session)
    existing = await repo.get_by_email(email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    admin = UserTable(
        id=str(uuid.uuid4()),
        name=name,
        email=email,
        password=hash_password(password),
        role="admin",
        created_at=datetime.utcnow(),
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)

    logger.info(f"Admin account created: {admin.id}")
    return {
        "userId": admin.id,
        "name": admin.name,
        "email": admin.email,
        "role": "admin",
    }


@router.get("/users")
async def admin_list_users(
    program: Optional[str] = None,
    has_recording: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _admin=Depends(require_admin),
    use_case: ListUsersUseCase = Depends(_get_list_users_use_case),
):
    users = await use_case.execute()

    if program:
        users = [
            u
            for u in users
            if u.session and u.session.program.lower() == program.lower()
        ]

    if has_recording is not None:
        users = [u for u in users if u.has_recording == has_recording]

    total = len(users)
    start = (page - 1) * page_size
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "items": users[start : start + page_size],
    }


@router.get("/users/{user_id}")
async def admin_get_user(
    user_id: str,
    _admin=Depends(require_admin),
    use_case: GetUserUseCase = Depends(_get_get_user_use_case),
):
    user_with_session, error = await use_case.execute(user_id)
    if error:
        raise HTTPException(status_code=404, detail=error)
    return user_with_session


@router.get("/sessions")
async def admin_list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    repo = SessionRepository(db_session)
    sessions = await repo.list_all()
    total = len(sessions)
    start = (page - 1) * page_size
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "items": sessions[start : start + page_size],
    }


@router.get("/triage")
async def admin_triage_queue(
    _admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    user_repo = UserRepository(db_session)
    session_repo = SessionRepository(db_session)
    scorer = CoreScorer()

    users = await user_repo.list_all()
    items = []

    for user in users:
        session = await session_repo.get_by_user_id(user.id)
        if not session:
            continue

        applicant_data = session.applicant_data
        evaluation = session.evaluation
        transcript = session.transcript

        scores = scorer.score_core(applicant_data, transcript, evaluation)

        items.append({
            "session_id": session.id,
            "user_name": user.name,
            "program": session.program,
            "evaluation": evaluation,
            "applicant_data": applicant_data,
            "baseline": scores["baseline"],
            "data_quality": scores["data_quality"],
            "agreement": scores["agreement"],
            "edge_cases": scores["edge_cases"],
            "inconsistencies": scores["inconsistencies"],
            "authenticity": scores["authenticity"],
        })

    return compute_triage_queue(items)


@router.get("/sessions/{session_id}")
async def admin_get_session(
    session_id: str,
    _admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    repo = SessionRepository(db_session)
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions/{session_id}/override")
async def admin_override_evaluation(
    session_id: str,
    payload: dict,
    admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    override_score = payload.get("override_score")
    override_recommendation = payload.get("override_recommendation")
    justification = payload.get("justification", "").strip()

    if override_score is None or not override_recommendation or not justification:
        raise HTTPException(
            status_code=400,
            detail="override_score, override_recommendation, and justification are required",
        )

    valid_recs = {r.value for r in Recommendation}
    if override_recommendation not in valid_recs:
        raise HTTPException(
            status_code=400,
            detail=f"override_recommendation must be one of: {', '.join(valid_recs)}",
        )

    repo = SessionRepository(db_session)
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    override_data = {
        "override_score": float(override_score),
        "override_recommendation": override_recommendation,
        "justification": justification,
        "admin_id": admin.id,
        "admin_name": admin.name,
        "overridden_at": datetime.utcnow().isoformat(),
        "original_score": (session.evaluation or {}).get("overall_score"),
        "original_recommendation": (session.evaluation or {}).get("recommendation"),
    }

    updated = await repo.update_override(session_id, override_data)
    logger.info(f"Admin {admin.id} overrode session {session_id}: {override_recommendation}")
    return {
        "session_id": session_id,
        "override_applied": True,
        "override": override_data,
    }


@router.post("/sessions/{session_id}/feedback")
async def admin_submit_feedback(
    session_id: str,
    payload: dict,
    admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    rating = payload.get("rating", "").strip()
    if rating not in {"accurate", "somewhat_accurate", "inaccurate"}:
        raise HTTPException(
            status_code=400,
            detail="rating must be: accurate | somewhat_accurate | inaccurate",
        )

    repo = SessionRepository(db_session)
    session = await repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    feedback_data = {
        "rating": rating,
        "comments": payload.get("comments", ""),
        "suggestions": payload.get("suggestions", ""),
        "admin_id": admin.id,
        "admin_name": admin.name,
        "submitted_at": datetime.utcnow().isoformat(),
    }

    await repo.update_feedback(session_id, feedback_data)
    logger.info(f"Admin {admin.id} submitted feedback for session {session_id}: {rating}")
    return {"session_id": session_id, "feedback_recorded": True, "rating": rating}


@router.post("/sessions/{session_id}/rating-events")
async def admin_create_rating_event(
    session_id: str,
    payload: dict,
    admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    """A committee admin creates their own human rating event for an indicator."""
    indicator = payload.get("indicator")
    valid_indicators = {i.value for i in RatingIndicator}
    if indicator not in valid_indicators:
        raise HTTPException(
            status_code=400,
            detail=f"indicator must be one of: {', '.join(sorted(valid_indicators))}",
        )

    band = payload.get("band")
    valid_bands = {b.value for b in RatingBand}
    if band not in valid_bands:
        raise HTTPException(
            status_code=400,
            detail=f"band must be one of: {', '.join(sorted(valid_bands))}",
        )

    quote = payload.get("quote", "").strip()
    if not quote:
        raise HTTPException(status_code=400, detail="quote or evaluation rationale is required")

    session_repo = SessionRepository(db_session)
    session = await session_repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    status_value = payload.get("status", RatingEventStatus.ACCEPTED.value)
    if status_value not in {RatingEventStatus.PROPOSED.value, RatingEventStatus.ACCEPTED.value}:
        status_value = RatingEventStatus.ACCEPTED.value

    from app.domain.entities import RatingEventCreate
    rating_event_repo = RatingEventRepository(db_session)
    event_create = RatingEventCreate(
        session_id=session_id,
        indicator=indicator,
        quote=quote,
        band=band,
        rater_type=RaterType.HUMAN.value,
        rater_id=admin.id,
    )
    created = await rating_event_repo.create(event_create, status=status_value)
    logger.info(f"Admin {admin.id} created human rating event {created.id} for session {session_id}: {band}")
    return created


@router.post("/sessions/{session_id}/rating-events/{event_id}/decide")
async def admin_decide_rating_event(
    session_id: str,
    event_id: str,
    payload: dict,
    admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    """A committee member accepts or rejects a model-proposed rating_event,
    optionally correcting its band/quote. This is the only way a rating_event
    ever becomes a durable human decision (SPEC Section 1: human actions are
    durable) -- a later model proposal for the same indicator inserts a new
    row rather than overwriting this one."""
    status_value = payload.get("status")
    valid_statuses = {RatingEventStatus.ACCEPTED.value, RatingEventStatus.REJECTED.value}
    if status_value not in valid_statuses:
        raise HTTPException(
            status_code=400, detail=f"status must be one of: {', '.join(sorted(valid_statuses))}"
        )

    band = payload.get("band")
    valid_bands = {b.value for b in RatingBand}
    if band is not None and band not in valid_bands:
        raise HTTPException(
            status_code=400, detail=f"band must be one of: {', '.join(sorted(valid_bands))}"
        )

    session_repo = SessionRepository(db_session)
    session = await session_repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    rating_event_repo = RatingEventRepository(db_session)
    event = await rating_event_repo.get_by_id(event_id)
    if not event or event.session_id != session_id:
        raise HTTPException(status_code=404, detail="Rating event not found")

    quote = payload.get("quote")
    if quote is not None:
        applicant_text = applicant_only_text(session.transcript or [])
        if not quote or quote not in applicant_text:
            raise HTTPException(
                status_code=400,
                detail="quote must be a verbatim applicant statement from the transcript",
            )

    updated = await rating_event_repo.update_status(
        event_id, status=status_value, rater_id=admin.id, band=band, quote=quote
    )
    logger.info(f"Admin {admin.id} decided rating event {event_id}: {status_value}")
    return updated


def _current_event_per_indicator(events: list) -> dict:
    """Per indicator, the most recent human-decided row if one exists, else
    the latest model-proposed row -- never a blended/aggregated value across
    rows (Section 1: distribution to committee, no hard thresholds).
    `events` is expected in created_at-ascending order (list_by_session's
    ordering), so the last matching entry is the most recent one."""
    by_indicator: dict = {indicator.value: [] for indicator in RatingIndicator}
    for event in events:
        if event.indicator in by_indicator:
            by_indicator[event.indicator].append(event)

    current = {}
    for indicator, indicator_events in by_indicator.items():
        human_events = [e for e in indicator_events if e.rater_type == RaterType.HUMAN.value]
        current[indicator] = human_events[-1] if human_events else (
            indicator_events[-1] if indicator_events else None
        )
    return current


@router.get("/committee")
async def admin_committee_grid(
    _admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    """One row per session, with each of the 3 in-scope indicators' current
    band/status -- no blended overall score field anywhere in the response
    (Section 5, criterion 3)."""
    session_repo = SessionRepository(db_session)
    user_repo = UserRepository(db_session)
    rating_event_repo = RatingEventRepository(db_session)

    sessions = await session_repo.list_all()
    items = []
    for session in sessions:
        user = await user_repo.get_by_id(session.user_id)
        if not user or user.role == "admin":
            continue
        events = await rating_event_repo.list_by_session(session.id)
        if not events and session.transcript and len(session.transcript) >= 2:
            try:
                from app.use_cases.propose_rating_events_use_case import ProposeRatingEventsUseCase
                proposer = ProposeRatingEventsUseCase(session_repo, rating_event_repo)
                events, _ = await proposer.execute(session.id)
                events = events or []
            except Exception as e:
                logger.warning(f"Could not propose rating events for {session.id}: {e}")
        current = _current_event_per_indicator(events)
        items.append(
            {
                "session_id": session.id,
                "user_id": session.user_id,
                "user_name": user.name if user else None,
                "program": session.program,
                "indicators": {
                    indicator: (
                        {
                            "band": event.band,
                            "status": event.status,
                            "rater_type": event.rater_type,
                        }
                        if event
                        else None
                    )
                    for indicator, event in current.items()
                },
            }
        )
    return {"items": items}


@router.get("/committee/{session_id}")
async def admin_committee_context(
    session_id: str,
    _admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    """The full rating_event distribution for one session, grouped by
    indicator with every quote visible -- the separate context panel
    (Section 5, criterion 3), distinct from the grid's single current value
    per indicator."""
    session_repo = SessionRepository(db_session)
    session = await session_repo.get_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user = await UserRepository(db_session).get_by_id(session.user_id)
    rating_event_repo = RatingEventRepository(db_session)
    events = await rating_event_repo.list_by_session(session_id)
    if not events and session.transcript and len(session.transcript) >= 2:
        try:
            from app.use_cases.propose_rating_events_use_case import ProposeRatingEventsUseCase
            proposer = ProposeRatingEventsUseCase(session_repo, rating_event_repo)
            events, _ = await proposer.execute(session.id)
            events = events or []
        except Exception as e:
            logger.warning(f"Could not propose rating events for context {session.id}: {e}")

    rating_events_by_indicator: dict = {indicator.value: [] for indicator in RatingIndicator}
    for event in events:
        if event.indicator in rating_events_by_indicator:
            rating_events_by_indicator[event.indicator].append(event)

    return {
        "session_id": session.id,
        "user_id": session.user_id,
        "user_name": user.name if user else None,
        "program": session.program,
        "transcript": session.transcript,
        "rating_events": rating_events_by_indicator,
    }
