
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.auth import require_admin
from app.infrastructure.database import get_session
from app.infrastructure.repositories import SessionRepository
from app.ml.data_quality import compute_data_quality_score
from app.ml.evaluation import compute_confidence_calibration, compute_score_distribution
from app.ml.scorer import CoreScorer
from app.use_cases.enhanced_analysis import EnhancedAnalysisUseCase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/metrics", tags=["validation"])


def _get_enhanced_analysis_use_case(db_session: AsyncSession = Depends(get_session)):
    return EnhancedAnalysisUseCase(SessionRepository(db_session), CoreScorer())


@router.get("/sessions/{session_id}")
async def get_session_metrics(
    session_id: str,
    _admin=Depends(require_admin),
    use_case: EnhancedAnalysisUseCase = Depends(_get_enhanced_analysis_use_case),
):
    result, error = await use_case.execute(session_id)
    if error:
        raise HTTPException(status_code=404, detail=error)
    return result


@router.get("/overview")
async def get_system_metrics(
    _admin=Depends(require_admin),
    db_session: AsyncSession = Depends(get_session),
):
    repo = SessionRepository(db_session)
    sessions = await repo.list_all()

    session_dicts = [
        {
            "applicant_data": s.applicant_data,
            "evaluation": s.evaluation,
            "transcript": s.transcript,
        }
        for s in sessions
    ]

    quality_scores = [
        compute_data_quality_score(s["applicant_data"], s["transcript"], s["evaluation"])["overall_score"]
        for s in session_dicts
    ]

    avg_quality = round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else None
    quality_buckets = {
        "high (≥80)": sum(1 for q in quality_scores if q >= 80),
        "medium (50-79)": sum(1 for q in quality_scores if 50 <= q < 80),
        "low (<50)": sum(1 for q in quality_scores if q < 50),
    }

    return {
        "total_sessions": len(sessions),
        "sessions_with_evaluation": sum(1 for s in session_dicts if s["evaluation"]),
        "sessions_with_transcript": sum(1 for s in session_dicts if s["transcript"]),
        "score_distribution": compute_score_distribution(session_dicts),
        "confidence_calibration": compute_confidence_calibration(session_dicts),
        "data_quality": {
            "average_score": avg_quality,
            "buckets": quality_buckets,
        },
    }
