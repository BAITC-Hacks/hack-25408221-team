
import logging
from typing import Optional, Tuple

from app.domain.interfaces import ScorerInterface, SessionRepositoryInterface
from app.ml.explainability import compute_feature_importance, explain_recommendation
from app.ml.iaf_scoring import compute_iaf_score
from app.ml.language_proficiency import compute_language_proficiency
from app.ml.triage import compute_priority_tier

logger = logging.getLogger(__name__)


class EnhancedAnalysisUseCase:
    def __init__(self, session_repo: SessionRepositoryInterface, scorer: ScorerInterface):
        self.session_repo = session_repo
        self.scorer = scorer

    async def execute(self, session_id: str) -> Tuple[Optional[dict], Optional[str]]:
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            return None, "Session not found"

        transcript = session.transcript
        applicant_data = session.applicant_data
        evaluation = session.evaluation

        scores = self.scorer.score_core(applicant_data, transcript, evaluation)
        data_quality = scores["data_quality"]
        baseline = scores["baseline"]
        agreement = scores["agreement"]
        inconsistencies = scores["inconsistencies"]
        edge_cases = scores["edge_cases"]
        authenticity = scores["authenticity"]

        explanation = explain_recommendation(evaluation, baseline)
        feature_importance = compute_feature_importance(applicant_data, evaluation)

        language_proficiency = compute_language_proficiency(transcript, applicant_data)
        iaf = compute_iaf_score(applicant_data, session.program)
        triage_priority = compute_priority_tier(evaluation, data_quality, agreement, edge_cases, inconsistencies.get("inconsistencies", []), authenticity)

        result = {
            "session_id": session_id,
            "data_quality": data_quality,
            "baseline_evaluation": baseline,
            "agreement": agreement,
            "error_analysis": {
                "inconsistencies": inconsistencies,
                "edge_cases": edge_cases,
            },
            "explainability": {
                "explanation": explanation,
                "feature_importance": feature_importance,
            },
            "authenticity": authenticity,
            "language_proficiency": language_proficiency,
            "iaf_score": iaf,
            "triage": {"priority": triage_priority},
        }

        logger.info(
            f"Enhanced analysis complete for session {session_id} — "
            f"quality={data_quality['overall_score']}, agreement={agreement['agreement']}"
        )
        return result, None
