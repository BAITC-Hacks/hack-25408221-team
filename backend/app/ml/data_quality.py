
from typing import Any, Dict, List, Optional

QUESTION_FIELDS = [
    "q1_why_applying",
    "q2_program_choice",
    "q3_challenge_overcome",
    "q4_long_term_goals",
    "q5_leadership",
    "q6_family_support",
]

SHORT_ANSWER_THRESHOLD = 15


def score_completeness(applicant_data: Optional[Dict[str, Any]]) -> dict:
    if not applicant_data:
        return {"score": 0.0, "missing_fields": QUESTION_FIELDS[:], "filled_fields": []}

    filled = [
        f for f in QUESTION_FIELDS
        if applicant_data.get(f) and len(str(applicant_data[f]).strip()) > SHORT_ANSWER_THRESHOLD
    ]
    missing = [f for f in QUESTION_FIELDS if f not in filled]
    score = (len(filled) / len(QUESTION_FIELDS)) * 100

    return {
        "score": round(score, 1),
        "missing_fields": missing,
        "filled_fields": filled,
        "total_questions": len(QUESTION_FIELDS),
        "answered_questions": len(filled),
    }


def score_transcript(transcript: Optional[List[dict]]) -> dict:
    if not transcript:
        return {"score": 0.0, "word_count": 0, "user_turns": 0, "assistant_turns": 0, "avg_words_per_answer": 0}

    user_entries = [t for t in transcript if t.get("role") == "user"]
    assistant_entries = [t for t in transcript if t.get("role") == "assistant"]
    user_words = sum(len(t.get("text", "").split()) for t in user_entries)

    if user_words >= 300:
        score = 100.0
    elif user_words >= 150:
        score = 70.0
    elif user_words >= 50:
        score = 40.0
    else:
        score = 10.0

    return {
        "score": score,
        "word_count": user_words,
        "user_turns": len(user_entries),
        "assistant_turns": len(assistant_entries),
        "avg_words_per_answer": round(user_words / max(len(user_entries), 1), 1),
    }


def detect_missing_answers(
    applicant_data: Optional[Dict[str, Any]],
    transcript: Optional[List[dict]],
) -> dict:
    issues = []

    if not applicant_data:
        issues.append({"type": "no_applicant_data", "severity": "critical"})
        return {"issues": issues, "has_issues": True}

    question_labels = {
        "q1_why_applying": "Q1: Why applying",
        "q2_program_choice": "Q2: Program choice",
        "q3_challenge_overcome": "Q3: Challenge overcome",
        "q4_long_term_goals": "Q4: Long-term goals",
        "q5_leadership": "Q5: Leadership",
        "q6_family_support": "Q6: Family support",
    }

    for field, label in question_labels.items():
        val = applicant_data.get(field, "")
        if not val or str(val).strip() == "":
            issues.append({"type": "missing_answer", "field": field, "label": label, "severity": "high"})
        elif len(str(val).strip()) < SHORT_ANSWER_THRESHOLD:
            issues.append({
                "type": "very_short_answer",
                "field": field,
                "label": label,
                "severity": "medium",
                "length": len(str(val).strip()),
            })

    return {"issues": issues, "has_issues": len(issues) > 0}


def compute_data_quality_score(
    applicant_data: Optional[Dict[str, Any]],
    transcript: Optional[List[dict]],
    evaluation: Optional[Dict[str, Any]],
) -> dict:
    completeness = score_completeness(applicant_data)
    transcript_quality = score_transcript(transcript)
    missing = detect_missing_answers(applicant_data, transcript)
    has_evaluation = bool(evaluation)

    overall = (
        completeness["score"] * 0.4
        + transcript_quality["score"] * 0.4
        + (100.0 if has_evaluation else 0.0) * 0.2
    )

    return {
        "overall_score": round(overall, 1),
        "completeness": completeness,
        "transcript_quality": transcript_quality,
        "missing_answers": missing,
        "has_evaluation": has_evaluation,
    }
