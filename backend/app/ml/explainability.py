
from typing import Any, Dict, List, Optional

QUESTION_LABELS = {
    "q1_why_applying": "Motivation for applying",
    "q2_program_choice": "Program selection rationale",
    "q3_challenge_overcome": "Resilience & problem-solving",
    "q4_long_term_goals": "Career clarity & goal alignment",
    "q5_leadership": "Leadership & initiative",
    "q6_family_support": "Support system",
}

RECOMMENDATION_TEXT = {
    "strongly_recommended": "Strongly Recommended — This candidate is an excellent fit for the program.",
    "recommended": "Recommended — This candidate meets the program requirements.",
    "needs_review": "Needs Review — Manual review is recommended before a final decision.",
    "not_recommended": "Not Recommended — This candidate does not currently meet the program requirements.",
}


def _extract_key_quotes(
    transcript: Optional[List[dict]],
    strengths: List[str],
    concerns: List[str],
    max_quotes: int = 3,
) -> List[dict]:
    if not transcript:
        return []

    user_turns = [
        e for e in transcript
        if e.get("role") == "user" and e.get("text") and len(e["text"].split()) >= 8
    ]

    if not user_turns:
        return []

    strength_words = set(" ".join(strengths).lower().split())
    concern_words = set(" ".join(concerns).lower().split())
    stopwords = {"the", "a", "an", "is", "was", "i", "my", "and", "or", "to", "of", "in", "it"}
    strength_words -= stopwords
    concern_words -= stopwords

    quotes = []
    used_turns: set = set()

    scored_turns = []
    for i, turn in enumerate(user_turns):
        words = set(turn["text"].lower().split()) - stopwords
        s_overlap = len(words & strength_words)
        c_overlap = len(words & concern_words)
        if s_overlap > 0 or c_overlap > 0:
            scored_turns.append((i, turn, s_overlap, c_overlap))

    scored_turns.sort(key=lambda x: x[2] + x[3], reverse=True)

    for i, turn, s_overlap, c_overlap in scored_turns[:max_quotes]:
        if i in used_turns:
            continue
        used_turns.add(i)

        text = turn["text"].strip()
        if len(text) > 150:
            text = text[:147] + "..."

        impact = "positive" if s_overlap >= c_overlap else "negative"
        quotes.append({
            "quote": f'"{text}"',
            "impact": impact,
        })

    return quotes


def compute_cohort_comparison(
    evaluation: Optional[Dict[str, Any]],
    all_sessions: Optional[List[Dict[str, Any]]],
) -> dict:
    if not evaluation or not all_sessions or len(all_sessions) < 5:
        return {
            "available": False,
            "note": "Insufficient cohort data (need ≥5 evaluated sessions)",
        }

    this_score = evaluation.get("overall_score")
    if this_score is None:
        return {"available": False, "note": "No overall_score in evaluation"}

    cohort_scores = []
    for sess in all_sessions:
        eval_data = sess.get("evaluation") or {}
        s = eval_data.get("overall_score")
        if s is not None:
            try:
                cohort_scores.append(float(s))
            except (TypeError, ValueError):
                pass

    if len(cohort_scores) < 5:
        return {"available": False, "note": "Insufficient cohort scores"}

    this_score_f = float(this_score)
    below = sum(1 for s in cohort_scores if s < this_score_f)
    percentile = round((below / len(cohort_scores)) * 100)

    mean = round(sum(cohort_scores) / len(cohort_scores), 1)
    sorted_scores = sorted(cohort_scores)
    median = sorted_scores[len(sorted_scores) // 2]

    return {
        "available": True,
        "percentile": percentile,
        "cohort_size": len(cohort_scores),
        "cohort_mean": mean,
        "cohort_median": median,
        "this_score": this_score_f,
        "context": _percentile_context(percentile),
    }


def _percentile_context(percentile: int) -> str:
    if percentile >= 90:
        return f"Top 10% of evaluated candidates"
    elif percentile >= 75:
        return f"Top 25% of evaluated candidates"
    elif percentile >= 50:
        return f"Above average ({percentile}th percentile)"
    elif percentile >= 25:
        return f"Below average ({percentile}th percentile)"
    else:
        return f"Bottom 25% of evaluated candidates"


def compute_uncertainty(
    evaluation: Optional[Dict[str, Any]],
    data_quality: Optional[Dict[str, Any]],
    edge_cases: Optional[Dict[str, Any]],
    agreement: Optional[Dict[str, Any]],
) -> dict:
    confidence = 90
    factors: List[str] = []

    quality_score = (data_quality or {}).get("overall_score", 100)
    reliability = (edge_cases or {}).get("reliability", "high")
    agreement_level = (agreement or {}).get("agreement", "exact")

    if quality_score < 50:
        confidence -= 25
        factors.append(f"Low data quality ({quality_score}/100) — answers may be incomplete")
    elif quality_score < 70:
        confidence -= 12
        factors.append(f"Moderate data quality ({quality_score}/100)")

    if reliability == "very_low":
        confidence -= 20
        factors.append("Multiple edge cases detected (short session, unusually long transcript, etc.)")
    elif reliability == "low":
        confidence -= 12
        factors.append("Edge cases detected — accuracy may be reduced")

    if agreement_level == "disagreement":
        confidence -= 18
        factors.append("AI and rule-based baseline strongly disagree — human review recommended")
    elif agreement_level == "adjacent":
        confidence -= 8
        factors.append("AI and baseline recommendations differ by one tier")

    if evaluation:
        score = evaluation.get("overall_score")
        if score is not None:
            if 4 <= float(score) <= 5:
                confidence -= 10
                factors.append("Score near needs_review / not_recommended boundary (4-5)")
            elif 6 <= float(score) <= 7:
                confidence -= 8
                factors.append("Score near recommended / needs_review boundary (6-7)")

    confidence = max(20, min(98, confidence))

    return {
        "confidence_pct": confidence,
        "uncertainty_factors": factors,
        "verdict": "high_confidence" if confidence >= 80 else "medium_confidence" if confidence >= 60 else "low_confidence",
    }


def explain_recommendation(
    evaluation: Optional[Dict[str, Any]],
    baseline_result: Optional[dict] = None,
    transcript: Optional[List[dict]] = None,
    all_sessions: Optional[List[Dict[str, Any]]] = None,
    data_quality: Optional[Dict[str, Any]] = None,
    edge_cases: Optional[Dict[str, Any]] = None,
    agreement: Optional[Dict[str, Any]] = None,
) -> dict:
    if not evaluation:
        return {
            "short_summary": "No evaluation available for this session.",
            "explanation": "No evaluation available for this session.",
            "recommendation": None,
            "factors": [],
            "key_quotes": [],
            "cohort_comparison": {"available": False, "note": "No evaluation"},
            "uncertainty": {"confidence_pct": 0, "uncertainty_factors": [], "verdict": "low_confidence"},
            "agreement_note": None,
        }

    recommendation = evaluation.get("recommendation", "needs_review")
    score = evaluation.get("overall_score")
    strengths = evaluation.get("strengths") or []
    concerns = evaluation.get("concerns") or evaluation.get("areas_for_improvement") or []
    overall_impression = evaluation.get("overall_impression") or evaluation.get("notes") or ""

    factors: List[dict] = []

    if score is not None:
        if float(score) >= 8:
            factors.append({"factor": f"Strong overall score ({score}/10)", "impact": "positive"})
        elif float(score) >= 6:
            factors.append({"factor": f"Moderate overall score ({score}/10)", "impact": "neutral"})
        else:
            factors.append({"factor": f"Below-average score ({score}/10)", "impact": "negative"})

    for strength in strengths[:3]:
        factors.append({"factor": strength, "impact": "positive"})

    for concern in concerns[:3]:
        factors.append({"factor": concern, "impact": "negative"})

    key_quotes = _extract_key_quotes(transcript, strengths, concerns)

    cohort_comparison = compute_cohort_comparison(evaluation, all_sessions)

    uncertainty = compute_uncertainty(evaluation, data_quality, edge_cases, agreement)

    agreement_note = None
    if baseline_result:
        base_rec = baseline_result.get("recommendation")
        if base_rec == recommendation:
            agreement_note = "The rule-based baseline agrees with this assessment."
        else:
            agreement_note = (
                f"Note: The rule-based baseline suggests '{base_rec}' — "
                "consider manual review to resolve the disagreement."
            )

    rec_text = RECOMMENDATION_TEXT.get(recommendation, f"Recommendation: {recommendation}")
    score_str = f" ({score}/10)" if score is not None else ""
    short_summary = rec_text.split(" — ")[0] + score_str + "."

    explanation = rec_text
    if overall_impression:
        explanation += f" {overall_impression}"

    positive_factors = [f["factor"] for f in factors if f["impact"] == "positive"]
    negative_factors = [f["factor"] for f in factors if f["impact"] == "negative"]
    if positive_factors:
        explanation += f" Key strength: {positive_factors[0]}."
    if negative_factors:
        explanation += f" Key concern: {negative_factors[0]}."

    if cohort_comparison.get("available"):
        explanation += f" {cohort_comparison['context']}."

    return {
        "short_summary": short_summary,
        "explanation": explanation,
        "recommendation": recommendation,
        "factors": factors,
        "key_quotes": key_quotes,
        "cohort_comparison": cohort_comparison,
        "uncertainty": uncertainty,
        "agreement_note": agreement_note,
    }


def compute_feature_importance(
    applicant_data: Optional[Dict[str, Any]],
    evaluation: Optional[Dict[str, Any]],
) -> dict:
    if not applicant_data:
        return {"features": {}, "note": "No applicant data available"}

    strengths_text = " ".join((evaluation or {}).get("strengths") or []).lower()
    concerns_text = " ".join(
        ((evaluation or {}).get("concerns") or (evaluation or {}).get("areas_for_improvement") or [])
    ).lower()

    features: Dict[str, Any] = {}

    for field, label in QUESTION_LABELS.items():
        answer = str(applicant_data.get(field, "")).strip()
        if not answer:
            features[field] = {"label": label, "importance": 0.0, "signal": "missing", "answer_length": 0}
            continue

        length_score = min(len(answer) / 200.0, 1.0)

        words = answer.lower().split()
        strength_overlap = sum(1 for w in words if w in strengths_text) / max(len(words), 1)
        concern_overlap = sum(1 for w in words if w in concerns_text) / max(len(words), 1)

        importance = length_score * 0.5 + strength_overlap * 0.3 + concern_overlap * 0.2

        if strength_overlap > concern_overlap and strength_overlap > 0.01:
            signal = "positive"
        elif concern_overlap > strength_overlap and concern_overlap > 0.01:
            signal = "negative"
        else:
            signal = "neutral"

        features[field] = {
            "label": label,
            "importance": round(importance, 3),
            "signal": signal,
            "answer_length": len(answer),
        }

    total = sum(f["importance"] for f in features.values())
    if total > 0:
        for f in features.values():
            f["normalized_importance"] = round(f["importance"] / total, 3)

    return {"features": features}
