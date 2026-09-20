
from typing import Any, Dict, List, Optional


_MOTIVATION_SPECIFIC = [
    "specifically because", "particularly", "unique to", "what drew me",
    "i researched", "i visited", "i attended", "i spoke with",
    "the reason i chose", "what distinguishes", "i noticed that",
    "unlike other", "what sets", "i was struck by",
    "именно потому", "мне особенно", "я изучил", "я посетил",
    "что отличает", "я обратил внимание",
]

_MOTIVATION_GENERIC = [
    "best university", "great reputation", "world class", "top ranked",
    "aligns with my goals", "aligns with my passion", "perfect fit",
    "i have always wanted", "it was my dream", "ever since i was young",
    "best environment", "excellent programs",
]

_RESILIENCE_SIGNALS = [
    "learned from", "what i learned", "taught me", "made me stronger",
    "i realized", "i understood", "changed my perspective", "helped me grow",
    "difficult but", "challenging but", "despite", "even though",
    "turned it into", "came back", "kept going", "didn't give up",
    "failure taught", "mistake helped",
    "научило меня", "понял что", "стало уроком", "вырос благодаря",
    "несмотря на", "преодолел", "не сдался",
]

_RESILIENCE_ABSENT = [
    "it was hard", "it was difficult", "i struggled",
    "never had challenges", "everything was fine", "no problems",
]

_VISION_SPECIFIC = [
    "within 5 years", "in 3 years", "by 2030", "step by step",
    "first i will", "after graduating", "with this degree",
    "specifically i want to", "my plan is to", "i intend to",
    "i will build", "i will launch", "i will work at", "i will found",
    "this program will help me by", "the skills i'll gain",
    "через 5 лет", "после окончания", "мой план", "конкретно хочу",
    "собираюсь создать", "буду работать в",
]

_VISION_VAGUE = [
    "i want to be successful", "i want to have a good career",
    "i want to help people", "i want to make a difference",
    "in the future", "someday", "eventually",
    "i'm not sure yet but", "i'll figure it out",
]

_COLLABORATIVE_SIGNALS = [
    "we built", "our team", "together we", "collaborated", "worked with",
    "helped my", "supported my", "taught others", "mentored",
    "community project", "group initiative", "as a team",
    "i listened to", "we decided together", "collective",
    "наша команда", "вместе мы", "помогал другим", "обучал",
    "работали совместно", "поддерживал",
]

_SELF_AWARENESS_SIGNALS = [
    "i need to improve", "i'm still learning", "i struggle with",
    "my weakness is", "area for growth", "i sometimes",
    "i have realized that i", "i know i need",
    "i can be better at", "looking back",
    "i wasn't always", "i used to struggle",
    "мне нужно улучшить", "я ещё учусь", "моя слабость",
    "я понимаю что", "я работаю над",
]

_CONTRIBUTION_SIGNALS = [
    "give back", "help others", "contribute to", "build for",
    "serve", "benefit", "for my community", "for my country",
    "impact society", "make it better for", "create opportunities for",
    "support those who", "help people who",
    "помочь другим", "вклад в", "для общества", "для страны",
    "создать возможности", "поддержать тех кто",
]


_PROGRAM_WEIGHTS: Dict[str, Dict[str, float]] = {
    "default": {
        "motivation_depth": 0.20,
        "resilience": 0.15,
        "vision_clarity": 0.15,
        "collaborative_orientation": 0.15,
        "self_awareness": 0.10,
        "authenticity": 0.15,
        "contribution_drive": 0.10,
    },
    "computer_science": {
        "motivation_depth": 0.18,
        "resilience": 0.15,
        "vision_clarity": 0.22,
        "collaborative_orientation": 0.12,
        "self_awareness": 0.10,
        "authenticity": 0.15,
        "contribution_drive": 0.08,
    },
    "business": {
        "motivation_depth": 0.18,
        "resilience": 0.12,
        "vision_clarity": 0.18,
        "collaborative_orientation": 0.20,
        "self_awareness": 0.12,
        "authenticity": 0.12,
        "contribution_drive": 0.08,
    },
    "medicine": {
        "motivation_depth": 0.20,
        "resilience": 0.18,
        "vision_clarity": 0.15,
        "collaborative_orientation": 0.12,
        "self_awareness": 0.12,
        "authenticity": 0.15,
        "contribution_drive": 0.08,
    },
    "education": {
        "motivation_depth": 0.18,
        "resilience": 0.12,
        "vision_clarity": 0.12,
        "collaborative_orientation": 0.15,
        "self_awareness": 0.12,
        "authenticity": 0.12,
        "contribution_drive": 0.19,
    },
}


def _get_program_weights(program: Optional[str]) -> Dict[str, float]:
    if not program:
        return _PROGRAM_WEIGHTS["default"]
    p = program.lower()
    for key in _PROGRAM_WEIGHTS:
        if key in p:
            return _PROGRAM_WEIGHTS[key]
    return _PROGRAM_WEIGHTS["default"]


def _count_signals(text: str, signals: List[str]) -> int:
    t = text.lower()
    return sum(1 for s in signals if s in t)


def _get_text(applicant_data: Optional[Dict[str, Any]], fields: List[str]) -> str:
    if not applicant_data:
        return ""
    return " ".join(str(applicant_data.get(f, "")) for f in fields if applicant_data.get(f))


def score_motivation_depth(applicant_data: Optional[Dict[str, Any]]) -> dict:
    text = _get_text(applicant_data, ["q1_why_applying", "q2_program_choice"])
    if not text.strip():
        return {"score": 1, "label": "no_data", "evidence": []}

    specific = _count_signals(text, _MOTIVATION_SPECIFIC)
    generic = _count_signals(text, _MOTIVATION_GENERIC)
    length = len(text.split())

    score = 3
    if specific >= 3:
        score += 1
    elif specific >= 1:
        score += 0.5
    if generic >= 3:
        score -= 1.5
    elif generic >= 1:
        score -= 0.5
    if length >= 100:
        score += 0.5
    if length < 30:
        score -= 1

    score = max(1, min(5, round(score)))
    labels = {1: "vague/generic", 2: "somewhat_generic", 3: "adequate", 4: "specific", 5: "highly_specific"}
    return {"score": score, "label": labels.get(score, "adequate"), "specific_signals": specific, "generic_signals": generic}


def score_resilience(applicant_data: Optional[Dict[str, Any]]) -> dict:
    text = _get_text(applicant_data, ["q3_challenge_overcome"])
    if not text.strip():
        return {"score": 1, "label": "no_data", "evidence": []}

    growth = _count_signals(text, _RESILIENCE_SIGNALS)
    absent = _count_signals(text, _RESILIENCE_ABSENT)
    length = len(text.split())

    score = 2
    if growth >= 3:
        score = 5
    elif growth >= 2:
        score = 4
    elif growth >= 1:
        score = 3
    if absent >= 2:
        score -= 1
    if length < 20:
        score = min(score, 2)
    if length >= 80:
        score = min(5, score + 0.5)

    score = max(1, min(5, round(score)))
    labels = {1: "no_challenge_mentioned", 2: "superficial", 3: "adequate_reflection", 4: "strong_growth_mindset", 5: "exceptional_resilience"}
    return {"score": score, "label": labels.get(score, "adequate_reflection"), "growth_signals": growth}


def score_vision_clarity(applicant_data: Optional[Dict[str, Any]]) -> dict:
    text = _get_text(applicant_data, ["q4_long_term_goals", "q2_program_choice"])
    if not text.strip():
        return {"score": 1, "label": "no_data", "evidence": []}

    specific = _count_signals(text, _VISION_SPECIFIC)
    vague = _count_signals(text, _VISION_VAGUE)
    length = len(text.split())

    score = 2
    if specific >= 3:
        score = 5
    elif specific >= 2:
        score = 4
    elif specific >= 1:
        score = 3
    if vague >= 3:
        score -= 1.5
    elif vague >= 1:
        score -= 0.5
    if length < 25:
        score = min(score, 2)

    score = max(1, min(5, round(score)))
    labels = {1: "no_goals", 2: "vague_goals", 3: "general_goals", 4: "clear_goals", 5: "specific_actionable_goals"}
    return {"score": score, "label": labels.get(score, "general_goals"), "specific_signals": specific, "vague_signals": vague}


def score_collaborative_orientation(applicant_data: Optional[Dict[str, Any]]) -> dict:
    text = _get_text(applicant_data, ["q5_leadership", "q4_long_term_goals", "q1_why_applying"])
    if not text.strip():
        return {"score": 1, "label": "no_data"}

    collab = _count_signals(text, _COLLABORATIVE_SIGNALS)
    length = len(text.split())

    if collab >= 4:
        score = 5
    elif collab >= 3:
        score = 4
    elif collab >= 2:
        score = 3
    elif collab >= 1:
        score = 2
    else:
        score = 1

    if length < 30:
        score = min(score, 2)

    score = max(1, min(5, round(score)))
    labels = {1: "no_team_evidence", 2: "minimal", 3: "mentions_teamwork", 4: "strong_collaborative", 5: "community_leader"}
    return {"score": score, "label": labels.get(score, "mentions_teamwork"), "collaborative_signals": collab}


def score_self_awareness(applicant_data: Optional[Dict[str, Any]]) -> dict:
    text = _get_text(applicant_data, ["q3_challenge_overcome", "q4_long_term_goals", "q1_why_applying"])
    if not text.strip():
        return {"score": 1, "label": "no_data"}

    awareness = _count_signals(text, _SELF_AWARENESS_SIGNALS)

    if awareness >= 3:
        score = 5
    elif awareness >= 2:
        score = 4
    elif awareness >= 1:
        score = 3
    else:
        score = 2

    score = max(1, min(5, round(score)))
    labels = {1: "no_reflection", 2: "minimal_reflection", 3: "adequate", 4: "reflective", 5: "highly_self_aware"}
    return {"score": score, "label": labels.get(score, "adequate"), "awareness_signals": awareness}


def score_authenticity(applicant_data: Optional[Dict[str, Any]]) -> dict:
    from app.ml.authenticity import compute_specificity_score
    result = compute_specificity_score(applicant_data, None)
    specificity = result.get("specificity_score", 50)

    if specificity >= 75:
        score = 5
    elif specificity >= 60:
        score = 4
    elif specificity >= 45:
        score = 3
    elif specificity >= 30:
        score = 2
    else:
        score = 1

    labels = {1: "very_generic", 2: "mostly_generic", 3: "mixed", 4: "mostly_specific", 5: "highly_personal"}
    return {"score": score, "label": labels.get(score, "mixed"), "specificity_score": specificity}


def score_contribution_drive(applicant_data: Optional[Dict[str, Any]]) -> dict:
    text = _get_text(applicant_data, ["q1_why_applying", "q4_long_term_goals", "q5_leadership"])
    if not text.strip():
        return {"score": 1, "label": "no_data"}

    contribution = _count_signals(text, _CONTRIBUTION_SIGNALS)

    if contribution >= 4:
        score = 5
    elif contribution >= 3:
        score = 4
    elif contribution >= 2:
        score = 3
    elif contribution >= 1:
        score = 2
    else:
        score = 1

    score = max(1, min(5, round(score)))
    labels = {1: "self_focused", 2: "mostly_self", 3: "balanced", 4: "other_oriented", 5: "strong_contributor"}
    return {"score": score, "label": labels.get(score, "balanced"), "contribution_signals": contribution}


def compute_iaf_score(
    applicant_data: Optional[Dict[str, Any]],
    program: Optional[str] = None,
) -> dict:
    weights = _get_program_weights(program)

    dimensions = {
        "motivation_depth": score_motivation_depth(applicant_data),
        "resilience": score_resilience(applicant_data),
        "vision_clarity": score_vision_clarity(applicant_data),
        "collaborative_orientation": score_collaborative_orientation(applicant_data),
        "self_awareness": score_self_awareness(applicant_data),
        "authenticity": score_authenticity(applicant_data),
        "contribution_drive": score_contribution_drive(applicant_data),
    }

    weighted_sum = sum(
        dimensions[dim]["score"] * weights.get(dim, 0.14)
        for dim in dimensions
    )
    iaf_score = round((weighted_sum - 1) / 4 * 100)

    if iaf_score >= 75:
        recommendation = "strongly_recommended"
    elif iaf_score >= 55:
        recommendation = "recommended"
    elif iaf_score >= 38:
        recommendation = "needs_review"
    else:
        recommendation = "not_recommended"

    sorted_dims = sorted(dimensions.items(), key=lambda x: x[1]["score"], reverse=True)
    top_dims = [d[0] for d in sorted_dims[:2]]
    weak_dims = [d[0] for d in sorted_dims[-2:] if d[1]["score"] <= 2]

    return {
        "iaf_score": iaf_score,
        "recommendation": recommendation,
        "program_profile": _resolve_program_key(program),
        "dimensions": {dim: data for dim, data in dimensions.items()},
        "top_dimensions": top_dims,
        "dimensions_needing_attention": weak_dims,
        "weight_profile": weights,
    }


def _resolve_program_key(program: Optional[str]) -> str:
    if not program:
        return "default"
    p = program.lower()
    for key in _PROGRAM_WEIGHTS:
        if key in p:
            return key
    return "default"
