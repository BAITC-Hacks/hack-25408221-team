
import logging

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.auth import require_admin
from app.infrastructure.database import get_session
from app.infrastructure.repositories import SessionRepository
from app.ml.fairness import (
    compute_language_parity,
    compute_program_parity,
    compute_score_variance,
    generate_fairness_report,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/fairness", tags=["fairness"])


def _sessions_as_dicts(sessions):
    return [
        {
            "program": s.program,
            "applicant_data": s.applicant_data,
            "evaluation": s.evaluation,
        }
        for s in sessions
    ]


@router.get("/report")
async def fairness_report(
    _admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    repo = SessionRepository(db_session)
    sessions = await repo.list_all()
    session_dicts = _sessions_as_dicts(sessions)
    return generate_fairness_report(session_dicts)


@router.get("/distribution")
async def score_distribution(
    _admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    repo = SessionRepository(db_session)
    sessions = await repo.list_all()
    session_dicts = _sessions_as_dicts(sessions)
    return compute_score_variance(session_dicts)


@router.get("/program-parity")
async def program_parity(
    _admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    repo = SessionRepository(db_session)
    sessions = await repo.list_all()
    session_dicts = _sessions_as_dicts(sessions)
    return compute_program_parity(session_dicts)


@router.get("/language-parity")
async def language_parity(
    _admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    repo = SessionRepository(db_session)
    sessions = await repo.list_all()
    session_dicts = _sessions_as_dicts(sessions)
    return compute_language_parity(session_dicts)
