from typing import Any, Dict, List, Optional

from app.domain.interfaces import ScorerInterface
from app.ml.authenticity import compute_authenticity_score
from app.ml.baseline import baseline_score_applicant
from app.ml.data_quality import compute_data_quality_score
from app.ml.error_analysis import detect_evaluation_inconsistencies, identify_edge_cases
from app.ml.evaluation import agreement_score


class CoreScorer(ScorerInterface):
    """Behavior-preserving consolidation of the 6-function bundle that used
    to be duplicated inline in admin_routes.py, demo_routes.py, and
    enhanced_analysis.py -- same functions, same order, same arguments."""

    def score_core(
        self,
        applicant_data: Optional[Dict[str, Any]],
        transcript: Optional[List[dict]],
        evaluation: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        data_quality = compute_data_quality_score(applicant_data, transcript, evaluation)
        baseline = baseline_score_applicant(applicant_data)

        ai_recommendation = (evaluation or {}).get("recommendation")
        agreement = agreement_score(ai_recommendation, baseline["recommendation"])

        inconsistencies = detect_evaluation_inconsistencies(evaluation)
        edge_cases = identify_edge_cases(transcript)
        authenticity = compute_authenticity_score(applicant_data, transcript)

        return {
            "data_quality": data_quality,
            "baseline": baseline,
            "agreement": agreement,
            "inconsistencies": inconsistencies,
            "edge_cases": edge_cases,
            "authenticity": authenticity,
        }
