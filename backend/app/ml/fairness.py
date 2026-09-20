
from collections import defaultdict
from typing import Any, Dict, List

PROGRAM_GAP_THRESHOLD = 0.30
LANGUAGE_GAP_THRESHOLD = 0.25


def _positive_rate(recommendations: List[str]) -> float:
    if not recommendations:
        return 0.0
    positive = sum(1 for r in recommendations if r in ("recommended", "strongly_recommended"))
    return round(positive / len(recommendations), 3)


def compute_program_parity(sessions: List[Dict[str, Any]]) -> dict:
    if not sessions:
        return {"sample_size": 0, "programs": {}, "flag": None}

    program_recs: Dict[str, List[str]] = defaultdict(list)

    for s in sessions:
        program = s.get("program") or "unknown"
        evaluation = s.get("evaluation") or {}
        rec = evaluation.get("recommendation")
        if rec:
            program_recs[program].append(rec)

    program_stats = {}
    for prog, recs in program_recs.items():
        program_stats[prog] = {
            "count": len(recs),
            "positive_rate": _positive_rate(recs),
            "distribution": {r: recs.count(r) for r in set(recs)},
        }

    eligible_rates = [v["positive_rate"] for v in program_stats.values() if v["count"] >= 3]
    flag = None
    if len(eligible_rates) >= 2:
        gap = max(eligible_rates) - min(eligible_rates)
        if gap > PROGRAM_GAP_THRESHOLD:
            flag = (
                f"Large recommendation gap between programs: {round(gap * 100, 1)}% "
                f"(threshold: {int(PROGRAM_GAP_THRESHOLD * 100)}%) — manual audit recommended"
            )

    return {
        "sample_size": len(sessions),
        "programs": program_stats,
        "flag": flag,
    }


def compute_language_parity(sessions: List[Dict[str, Any]]) -> dict:
    if not sessions:
        return {"sample_size": 0, "languages": {}, "flag": None}

    lang_recs: Dict[str, List[str]] = defaultdict(list)

    for s in sessions:
        applicant_data = s.get("applicant_data") or {}
        lang = (applicant_data.get("language_used") or "unknown").lower().strip() or "unknown"
        evaluation = s.get("evaluation") or {}
        rec = evaluation.get("recommendation")
        if rec:
            lang_recs[lang].append(rec)

    lang_stats = {}
    for lang, recs in lang_recs.items():
        lang_stats[lang] = {
            "count": len(recs),
            "positive_rate": _positive_rate(recs),
        }

    eligible_rates = [v["positive_rate"] for v in lang_stats.values() if v["count"] >= 3]
    flag = None
    if len(eligible_rates) >= 2:
        gap = max(eligible_rates) - min(eligible_rates)
        if gap > LANGUAGE_GAP_THRESHOLD:
            flag = (
                f"Potential language bias: {round(gap * 100, 1)}% gap in recommendation rates "
                f"(threshold: {int(LANGUAGE_GAP_THRESHOLD * 100)}%) — review non-English evaluations"
            )

    return {
        "sample_size": len(sessions),
        "languages": lang_stats,
        "flag": flag,
    }


def compute_score_variance(sessions: List[Dict[str, Any]]) -> dict:
    scores = []
    for s in sessions:
        evaluation = s.get("evaluation") or {}
        score = evaluation.get("overall_score")
        if score is not None:
            scores.append(float(score))

    if len(scores) < 5:
        return {
            "sample_size": len(scores),
            "flag": "insufficient_data (need ≥5 sessions)",
        }

    mean = sum(scores) / len(scores)
    variance = sum((x - mean) ** 2 for x in scores) / len(scores)
    stdev = variance ** 0.5

    flags = []
    if stdev < 0.5:
        flags.append("Very low variance — scores may be artificially clustered")
    if mean > 9.0:
        flags.append("Mean score very high — possible grade inflation")
    if mean < 3.0:
        flags.append("Mean score very low — possible systematic underscoring")

    return {
        "sample_size": len(scores),
        "mean": round(mean, 2),
        "stdev": round(stdev, 2),
        "min": round(min(scores), 2),
        "max": round(max(scores), 2),
        "flags": flags,
    }


def generate_fairness_report(sessions: List[Dict[str, Any]]) -> dict:
    program_parity = compute_program_parity(sessions)
    language_parity = compute_language_parity(sessions)
    score_variance = compute_score_variance(sessions)

    all_flags = [f for f in [program_parity.get("flag"), language_parity.get("flag")] if f]
    all_flags += score_variance.get("flags", [])

    return {
        "program_parity": program_parity,
        "language_parity": language_parity,
        "score_variance": score_variance,
        "overall_flags": all_flags,
        "requires_audit": len(all_flags) > 0,
    }
