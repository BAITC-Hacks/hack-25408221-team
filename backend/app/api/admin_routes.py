import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.core.security import hash_password
from app.core.auth import require_admin
from app.infrastructure.database import get_session
from app.infrastructure.models import UserTable
from app.infrastructure.repositories import SessionRepository, UserRepository
from app.ml.authenticity import compute_authenticity_score
from app.ml.baseline import baseline_score_applicant
from app.ml.data_quality import compute_data_quality_score
from app.ml.error_analysis import detect_evaluation_inconsistencies, identify_edge_cases
from app.ml.evaluation import agreement_score
from app.ml.triage import compute_triage_queue
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

    logger.info(f"Admin account created: {email}")
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

    users = await user_repo.list_all()
    items = []

    for user in users:
        session = await session_repo.get_by_user_id(user.id)
        if not session:
            continue

        applicant_data = session.applicant_data
        evaluation = session.evaluation
        transcript = session.transcript

        data_quality = compute_data_quality_score(applicant_data, transcript, evaluation)
        baseline = baseline_score_applicant(applicant_data)
        ai_rec = (evaluation or {}).get("recommendation")
        agr = agreement_score(ai_rec, baseline["recommendation"])
        inconsistencies = detect_evaluation_inconsistencies(evaluation, applicant_data)
        edge_cases = identify_edge_cases(transcript, applicant_data)
        authenticity = compute_authenticity_score(applicant_data, transcript)

        items.append({
            "session_id": session.id,
            "user_name": user.name,
            "program": session.program,
            "evaluation": evaluation,
            "applicant_data": applicant_data,
            "baseline": baseline,
            "data_quality": data_quality,
            "agreement": agr,
            "edge_cases": edge_cases,
            "inconsistencies": inconsistencies,
            "authenticity": authenticity,
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

    valid_recs = {"strongly_recommended", "recommended", "needs_review", "not_recommended"}
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
