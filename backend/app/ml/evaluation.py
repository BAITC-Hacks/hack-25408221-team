
from typing import Any, Dict, List, Optional

RECOMMENDATION_ORDER = {
    "strongly_recommended": 4,
    "recommended": 3,
    "needs_review": 2,
    "not_recommended": 1,
}


def agreement_score(ai_recommendation: Optional[str], baseline_recommendation: str) -> dict:
    if not ai_recommendation:
        return {
            "agreement": "unknown",
            "score": 0.0,
            "ai_recommendation": None,
            "baseline_recommendation": baseline_recommendation,
            "explanation": "No AI recommendation available",
        }

    ai_rank = RECOMMENDATION_ORDER.get(ai_recommendation, 2)
    base_rank = RECOMMENDATION_ORDER.get(baseline_recommendation, 2)
    diff = abs(ai_rank - base_rank)

    if diff == 0:
        agreement, score = "exact", 1.0
    elif diff == 1:
        agreement, score = "adjacent", 0.5
    else:
        agreement, score = "disagreement", 0.0

    return {
        "agreement": agreement,
        "score": score,
        "ai_recommendation": ai_recommendation,
        "baseline_recommendation": baseline_recommendation,
        "explanation": (
            f"AI says '{ai_recommendation}', baseline says '{baseline_recommendation}' (rank diff={diff})"
        ),
    }


def compute_confidence_calibration(sessions: List[Dict[str, Any]]) -> dict:
    if not sessions:
        return {"calibration": "insufficient_data", "sample_size": 0, "confidence_buckets": {}}

    confidence_buckets: Dict[str, List[str]] = {"high": [], "medium": [], "low": []}

    for s in sessions:
        applicant_data = s.get("applicant_data") or {}
        evaluation = s.get("evaluation") or {}
        confidence = applicant_data.get("confidence_level", "medium")
        recommendation = evaluation.get("recommendation", "needs_review")
        if confidence in confidence_buckets:
            confidence_buckets[confidence].append(recommendation)

    result = {}
    for level, recs in confidence_buckets.items():
        if recs:
            positive = sum(1 for r in recs if r in ("recommended", "strongly_recommended"))
            result[level] = {
                "count": len(recs),
                "positive_rate": round(positive / len(recs), 2),
                "distribution": {r: recs.count(r) for r in set(recs)},
            }
        else:
            result[level] = {"count": 0, "positive_rate": None, "distribution": {}}

    high_pos = (result.get("high") or {}).get("positive_rate") or 0.0
    low_pos = (result.get("low") or {}).get("positive_rate") or 0.0
    is_calibrated = high_pos >= low_pos

    return {
        "calibration": "well_calibrated" if is_calibrated else "miscalibrated",
        "sample_size": len(sessions),
        "confidence_buckets": result,
        "note": "Well-calibrated means high-confidence sessions have higher positive recommendation rates",
    }


def compute_score_distribution(sessions: List[Dict[str, Any]]) -> dict:
    if not sessions:
        return {"sample_size": 0, "score_stats": {}, "recommendation_distribution": {}}

    scores = []
    recommendations = []

    for s in sessions:
        evaluation = s.get("evaluation") or {}
        if evaluation.get("overall_score") is not None:
            scores.append(float(evaluation["overall_score"]))
        if evaluation.get("recommendation"):
            recommendations.append(evaluation["recommendation"])

    rec_counts = {r: recommendations.count(r) for r in set(recommendations)}

    score_stats: Dict[str, Any] = {"count": len(scores)}
    if scores:
        score_stats["mean"] = round(sum(scores) / len(scores), 2)
        score_stats["min"] = round(min(scores), 2)
        score_stats["max"] = round(max(scores), 2)

    return {
        "sample_size": len(sessions),
        "score_stats": score_stats,
        "recommendation_distribution": rec_counts,
    }
