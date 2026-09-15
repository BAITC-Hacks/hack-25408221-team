
from typing import Any, Dict, List, Optional

STRENGTH_KEYWORDS = [
    "passion", "motivated", "dedicated", "experience", "achieve", "success",
    "team", "leadership", "initiative", "problem", "solution", "goal",
    "community", "support", "learn", "grow", "improve", "challenge",
    "contribute", "develop", "aspire", "committed", "driven",
    "innovation", "impact", "build", "create", "founded", "launched",
    "стремлюсь", "мотивирован", "увлечён", "увлечена", "целеустремлён",
    "лидерство", "команда", "достижение", "развитие", "улучшить",
    "создать", "помочь", "вклад", "решение", "опыт", "рост",
    "цель", "мечта", "инициатива", "ответственность", "стремление",
    "достижения", "результат", "успех", "строить", "запустил",
    "мақсат", "армандаймын", "жетістік", "көмектесу", "дамыту",
    "ұжым", "жетекші", "жауапкершілік", "тәжірибе", "білім",
    "өсу", "жетілдіру", "шешім", "бастама", "жасау",
]

CONCERN_KEYWORDS = [
    "don't know", "not sure", "maybe", "i guess", "whatever", "nothing",
    "n/a", "no answer", "skip", "idk", "no idea",
    "не знаю", "не уверен", "не уверена", "может быть", "наверное",
    "без разницы", "ничего", "не знаю что сказать", "затрудняюсь",
    "білмеймін", "сенімді емеспін", "мүмкін", "ештеңе жоқ",
]

QUESTION_FIELDS = [
    "q1_why_applying",
    "q2_program_choice",
    "q3_challenge_overcome",
    "q4_long_term_goals",
    "q5_leadership",
    "q6_family_support",
]


def _count_keywords(text: str, keywords: List[str]) -> int:
    text_lower = text.lower()
    return sum(1 for kw in keywords if kw in text_lower)


def baseline_score_applicant(applicant_data: Optional[Dict[str, Any]]) -> dict:
    if not applicant_data:
        return {
            "score": 0.0,
            "recommendation": "not_recommended",
            "confidence": "low",
            "reasoning": "No applicant data available",
            "answered_questions": 0,
            "avg_chars_per_answer": 0,
            "strength_keywords_found": 0,
            "concern_keywords_found": 0,
        }

    total_chars = 0
    total_strength_keywords = 0
    total_concern_keywords = 0
    answered_questions = 0

    for field in QUESTION_FIELDS:
        val = str(applicant_data.get(field, "")).strip()
        if val and len(val) > 10:
            answered_questions += 1
            total_chars += len(val)
            total_strength_keywords += _count_keywords(val, STRENGTH_KEYWORDS)
            total_concern_keywords += _count_keywords(val, CONCERN_KEYWORDS)

    avg_chars = total_chars / max(answered_questions, 1)

    completeness_score = (answered_questions / 6) * 4

    if avg_chars >= 200:
        length_score = 3.0
    elif avg_chars >= 100:
        length_score = 2.0
    elif avg_chars >= 50:
        length_score = 1.0
    else:
        length_score = 0.0

    keyword_score = min(total_strength_keywords * 0.3, 3.0)
    concern_penalty = min(total_concern_keywords * 0.5, 2.0)

    score = min(10.0, max(0.0, completeness_score + length_score + keyword_score - concern_penalty))

    if score >= 7:
        recommendation = "recommended"
    elif score >= 5:
        recommendation = "needs_review"
    else:
        recommendation = "not_recommended"

    return {
        "score": round(score, 1),
        "recommendation": recommendation,
        "confidence": "low",
        "reasoning": (
            f"Rule-based: {answered_questions}/6 questions answered, "
            f"avg {int(avg_chars)} chars/answer, "
            f"{total_strength_keywords} strength indicators found"
        ),
        "answered_questions": answered_questions,
        "avg_chars_per_answer": int(avg_chars),
        "strength_keywords_found": total_strength_keywords,
        "concern_keywords_found": total_concern_keywords,
    }
