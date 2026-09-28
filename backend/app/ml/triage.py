
from typing import Any, Dict, List, Optional


_POSITIVE_RECS = {"strongly_recommended", "recommended"}
_NEGATIVE_RECS = {"not_recommended"}


def _get_recommendation(evaluation: Optional[Dict[str, Any]]) -> Optional[str]:
    if not evaluation:
        return None
    return evaluation.get("recommendation")


def _get_overall_score(evaluation: Optional[Dict[str, Any]]) -> Optional[float]:
    if not evaluation:
        return None
    score = evaluation.get("overall_score")
    if score is None:
        return None
    try:
        return float(score)
    except (TypeError, ValueError):
        return None


def compute_priority_tier(
    evaluation: Optional[Dict[str, Any]],
    data_quality: Optional[Dict[str, Any]],
    agreement: Optional[Dict[str, Any]],
    edge_cases: Optional[Dict[str, Any]],
    inconsistencies: Optional[List[Any]] = None,
    authenticity: Optional[Dict[str, Any]] = None,
) -> dict:
    reasons: List[str] = []

    recommendation = _get_recommendation(evaluation)
    score = _get_overall_score(evaluation)
    quality_score = (data_quality or {}).get("overall_score", 0)
    agreement_level = (agreement or {}).get("agreement", "")
    reliability = (edge_cases or {}).get("reliability", "high")
    inconsistency_count = len(inconsistencies or [])
    auth_risk = (authenticity or {}).get("risk_level", "low")

    tier4_triggers = []
    if reliability in ("low", "very_low"):
        tier4_triggers.append(f"reliability={reliability}")
    if inconsistency_count >= 2:
        tier4_triggers.append(f"{inconsistency_count} evaluation inconsistencies")
    if auth_risk == "high":
        tier4_triggers.append("authenticity risk=high")
    if agreement_level == "disagreement":
        tier4_triggers.append("AI/baseline strong disagreement")

    if tier4_triggers:
        return {
            "tier": 4,
            "label": "Manual Required",
            "estimated_review_minutes": 45,
            "reasons": tier4_triggers,
        }

    tier3_triggers = []
    if recommendation in _NEGATIVE_RECS:
        tier3_triggers.append("not_recommended by AI")
    if quality_score < 50:
        tier3_triggers.append(f"data quality low ({quality_score}/100)")
    if score is not None and score < 4:
        tier3_triggers.append(f"overall score very low ({score}/10)")

    if tier3_triggers:
        return {
            "tier": 3,
            "label": "Hold Queue",
            "estimated_review_minutes": 5,
            "reasons": tier3_triggers,
        }

    tier1_conditions = [
        recommendation in _POSITIVE_RECS,
        quality_score >= 75,
        agreement_level == "exact",
        reliability == "high",
        auth_risk in ("low", "medium"),
        inconsistency_count == 0,
    ]
    if sum(tier1_conditions) >= 5:
        return {
            "tier": 1,
            "label": "Fast Track",
            "estimated_review_minutes": 5,
            "reasons": ["strong AI score", "high data quality", "AI/baseline aligned", "no anomalies"],
        }

    return {
        "tier": 2,
        "label": "Standard Review",
        "estimated_review_minutes": 12,
        "reasons": reasons or ["standard candidate profile"],
    }


def generate_summary_card(
    user_name: str,
    program: str,
    evaluation: Optional[Dict[str, Any]],
    applicant_data: Optional[Dict[str, Any]],
    baseline: Optional[Dict[str, Any]],
    data_quality: Optional[Dict[str, Any]],
    triage: Optional[Dict[str, Any]],
    authenticity: Optional[Dict[str, Any]] = None,
) -> dict:
    recommendation = _get_recommendation(evaluation)
    score = _get_overall_score(evaluation)
    quality_score = (data_quality or {}).get("overall_score", 0)
    tier = (triage or {}).get("tier", 2)
    tier_label = (triage or {}).get("label", "Standard Review")

    strengths = (evaluation or {}).get("strengths", [])[:3]
    concerns = (evaluation or {}).get("concerns", [])[:2]
    overall_impression = (evaluation or {}).get("overall_impression", "")

    baseline_rec = (baseline or {}).get("recommendation", "unknown")
    auth_risk = (authenticity or {}).get("risk_level", "low")
    auth_score = (authenticity or {}).get("authenticity_score", 50)

    language = (applicant_data or {}).get("language_used", "unknown")
    confidence = (applicant_data or {}).get("confidence_level", "unknown")
    comm_quality = (applicant_data or {}).get("communication_quality", "unknown")

    score_str = f"{score}/10" if score is not None else "N/A"
    headline = f"{user_name} — {program} | {recommendation or 'pending'} ({score_str})"

    key_insight = ""
    for field in ["q5_leadership", "q4_long_term_goals", "q1_why_applying"]:
        val = (applicant_data or {}).get(field, "")
        if val and len(val) > 30:
            key_insight = val[:200] + ("..." if len(val) > 200 else "")
            break

    alert_flags = []
    if auth_risk == "high":
        alert_flags.append("⚠️ Authenticity risk: possible coached responses")
    if tier == 4:
        alert_flags.append("⚠️ Manual review required")
    if concerns:
        alert_flags.extend([f"⚠️ {c}" for c in concerns])

    return {
        "headline": headline,
        "tier": tier,
        "tier_label": tier_label,
        "score": score,
        "recommendation": recommendation,
        "quality_score": quality_score,
        "key_insight": key_insight,
        "strengths": strengths,
        "alert_flags": alert_flags,
        "signals": {
            "language": language,
            "confidence": confidence,
            "communication": comm_quality,
            "baseline_agreement": baseline_rec,
            "authenticity_score": auth_score,
            "authenticity_risk": auth_risk,
        },
        "overall_impression": overall_impression,
    }


def compute_triage_queue(sessions_with_analysis: List[Dict[str, Any]]) -> Dict[str, Any]:
    tiered: Dict[int, List[Dict[str, Any]]] = {1: [], 2: [], 3: [], 4: []}

    for item in sessions_with_analysis:
        triage = compute_priority_tier(
            evaluation=item.get("evaluation"),
            data_quality=item.get("data_quality"),
            agreement=item.get("agreement"),
            edge_cases=item.get("edge_cases"),
            inconsistencies=item.get("inconsistencies", []),
            authenticity=item.get("authenticity"),
        )

        card = generate_summary_card(
            user_name=item.get("user_name", "Unknown"),
            program=item.get("program", "Unknown"),
            evaluation=item.get("evaluation"),
            applicant_data=item.get("applicant_data"),
            baseline=item.get("baseline"),
            data_quality=item.get("data_quality"),
            triage=triage,
            authenticity=item.get("authenticity"),
        )

        entry = {
            "session_id": item.get("session_id"),
            "triage": triage,
            "summary_card": card,
        }
        tier = triage["tier"]
        tiered[tier].append(entry)

    def sort_key(e: Dict[str, Any]) -> float:
        score = (e["summary_card"].get("score") or 0)
        return -score

    for t in tiered:
        tiered[t].sort(key=sort_key)

    total = sum(len(v) for v in tiered.values())
    return {
        "total": total,
        "tier_counts": {f"tier_{t}": len(tiered[t]) for t in tiered},
        "estimated_total_review_hours": round(
            sum(
                e["triage"]["estimated_review_minutes"]
                for items in tiered.values()
                for e in items
            ) / 60,
            1,
        ),
        "queue": {
            "tier_1_fast_track": tiered[1],
            "tier_2_standard": tiered[2],
            "tier_3_hold": tiered[3],
            "tier_4_manual": tiered[4],
        },
    }
