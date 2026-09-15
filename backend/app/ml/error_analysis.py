
from typing import Any, Dict, List, Optional


def detect_evaluation_inconsistencies(
    evaluation: Optional[Dict[str, Any]],
    applicant_data: Optional[Dict[str, Any]],
) -> dict:
    if not evaluation:
        return {
            "inconsistencies": [],
            "has_inconsistencies": False,
            "note": "No evaluation to check",
        }

    inconsistencies = []
    score = evaluation.get("overall_score")
    recommendation = evaluation.get("recommendation", "")
    strengths = evaluation.get("strengths") or []
    concerns = evaluation.get("concerns") or evaluation.get("areas_for_improvement") or []

    if score is not None and recommendation:
        if score >= 8 and recommendation in ("not_recommended", "needs_review"):
            inconsistencies.append({
                "type": "score_recommendation_mismatch",
                "severity": "high",
                "detail": f"Score {score}/10 but recommendation is '{recommendation}'",
            })
        if score <= 4 and recommendation in ("recommended", "strongly_recommended"):
            inconsistencies.append({
                "type": "score_recommendation_mismatch",
                "severity": "high",
                "detail": f"Score {score}/10 but recommendation is '{recommendation}'",
            })

    if len(strengths) >= 3 and recommendation == "not_recommended":
        inconsistencies.append({
            "type": "many_strengths_but_rejected",
            "severity": "medium",
            "detail": f"{len(strengths)} strengths listed but recommendation is 'not_recommended'",
        })

    if len(concerns) == 0 and recommendation == "not_recommended":
        inconsistencies.append({
            "type": "no_concerns_but_rejected",
            "severity": "medium",
            "detail": "No concerns/areas_for_improvement listed but recommendation is 'not_recommended'",
        })

    if applicant_data:
        comm_quality = applicant_data.get("communication_quality", "")
        if comm_quality == "excellent" and score is not None and score < 5:
            inconsistencies.append({
                "type": "communication_score_mismatch",
                "severity": "low",
                "detail": f"Communication quality is 'excellent' but overall score is {score}",
            })

    return {
        "inconsistencies": inconsistencies,
        "has_inconsistencies": len(inconsistencies) > 0,
        "count": len(inconsistencies),
    }


def identify_edge_cases(
    transcript: Optional[List[dict]],
    applicant_data: Optional[Dict[str, Any]],
) -> dict:
    edge_cases = []

    if not transcript:
        edge_cases.append({"type": "no_transcript", "severity": "critical"})
        return {"edge_cases": edge_cases, "reliability": "very_low", "edge_case_count": 1}

    user_turns = [t for t in transcript if t.get("role") == "user"]

    if len(user_turns) < 3:
        edge_cases.append({
            "type": "very_short_session",
            "severity": "high",
            "detail": f"Only {len(user_turns)} user turn(s) detected",
        })

    if len(transcript) > 100:
        edge_cases.append({
            "type": "unusually_long_transcript",
            "severity": "low",
            "detail": f"Transcript has {len(transcript)} entries — possible repetition",
        })

    if applicant_data:
        lang = (applicant_data.get("language_used") or "english").lower()
        if lang not in ("english", "en", ""):
            edge_cases.append({
                "type": "non_english_interview",
                "severity": "low",
                "detail": f"Primary language detected: {lang}",
            })

        if applicant_data.get("confidence_level") == "low":
            edge_cases.append({
                "type": "low_confidence_assessment",
                "severity": "medium",
                "detail": "AI reported low confidence in its own assessment",
            })

        if applicant_data.get("communication_quality") == "poor":
            edge_cases.append({
                "type": "poor_communication",
                "severity": "medium",
                "detail": "AI assessed communication quality as 'poor'",
            })

    critical_count = sum(1 for e in edge_cases if e["severity"] in ("critical", "high"))
    reliability_map = {0: "high", 1: "medium", 2: "low"}
    reliability = reliability_map.get(min(critical_count, 2), "very_low")

    return {
        "edge_cases": edge_cases,
        "reliability": reliability,
        "edge_case_count": len(edge_cases),
    }
