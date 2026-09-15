
import re
from typing import Any, Dict, List, Optional

_GRAMMAR_ERROR_PATTERNS = [
    r"\bi am agree\b",
    r"\bi am knowing\b",
    r"\bi am having\b",
    r"\bi am wanting\b",
    r"\bi am liking\b",
    r"\bhe don't\b",
    r"\bshe don't\b",
    r"\bthey was\b",
    r"\bwe was\b",
    r"\bi have \d+ years\b",
    r"\bmore better\b",
    r"\bmore easier\b",
    r"\bvery much interested\b",
    r"\bi am coming from\b",
    r"\bdepends of\b",
    r"\binterested about\b",
    r"\bmarried with\b",
    r"\bexplain me\b",
    r"\btell me about this\b",
]

_ADVANCED_VOCAB = [
    "consequently", "furthermore", "nevertheless", "notwithstanding",
    "proficiency", "initiative", "endeavour", "perseverance",
    "resilience", "synthesize", "collaborate", "innovate",
    "entrepreneurial", "transformative", "sustainable", "strategic",
    "catalyze", "facilitate", "implement", "leverage",
    "comprehensive", "articulate", "eloquent", "coherent",
    "следовательно", "тем не менее", "посредством", "вследствие",
    "инициатива", "предпринимательство", "устойчивый", "стратегический",
]

_DISCOURSE_CONNECTORS = [
    "however", "therefore", "furthermore", "in addition", "as a result",
    "on the other hand", "in contrast", "for example", "for instance",
    "in conclusion", "to summarize", "first", "second", "third",
    "finally", "moreover", "consequently", "although", "despite",
    "because of this", "this led to", "as a consequence",
    "однако", "поэтому", "кроме того", "в результате", "с другой стороны",
    "например", "во-первых", "во-вторых", "в-третьих", "наконец",
    "следовательно", "таким образом", "несмотря на", "поскольку",
]

_CEFR_BANDS = [
    (85, "C2"),
    (72, "C1"),
    (58, "B2"),
    (44, "B1"),
    (30, "A2"),
    (0,  "A1"),
]


def _extract_user_text(transcript: Optional[List[dict]]) -> str:
    if not transcript:
        return ""
    parts = [e.get("text", "") for e in transcript if e.get("role") == "user" and e.get("text")]
    return " ".join(parts)


def _compute_grammar_score(text: str) -> dict:
    if not text.strip():
        return {"score": 50, "error_count": 0, "error_rate": 0.0}

    words = text.split()
    word_count = max(len(words), 1)

    error_count = sum(
        len(re.findall(pattern, text, re.IGNORECASE))
        for pattern in _GRAMMAR_ERROR_PATTERNS
    )

    error_rate = error_count / (word_count / 100)
    score = max(20, min(100, 100 - (error_rate * 14)))

    return {
        "score": round(score),
        "error_count": error_count,
        "error_rate": round(error_rate, 2),
    }


def _compute_vocabulary_score(text: str) -> dict:
    if not text.strip():
        return {"score": 50, "ttr": 0.0, "advanced_count": 0, "total_words": 0}

    words = re.findall(r"\b\w+\b", text.lower())
    total_words = len(words)
    if total_words == 0:
        return {"score": 50, "ttr": 0.0, "advanced_count": 0, "total_words": 0}

    unique_words = len(set(words))
    ttr = unique_words / total_words

    advanced_count = sum(1 for term in _ADVANCED_VOCAB if term in text.lower())

    ttr_score = min(100, max(0, (ttr - 0.25) / 0.40 * 70))
    adv_bonus = min(30, advanced_count * 5)

    score = min(100, ttr_score + adv_bonus)

    return {
        "score": round(score),
        "ttr": round(ttr, 3),
        "unique_words": unique_words,
        "total_words": total_words,
        "advanced_count": advanced_count,
    }


def _compute_fluency_score(transcript: Optional[List[dict]]) -> dict:
    if not transcript:
        return {"score": 50, "avg_words_per_turn": 0, "turn_count": 0}

    user_turns = [e.get("text", "") for e in transcript if e.get("role") == "user" and e.get("text")]
    if not user_turns:
        return {"score": 50, "avg_words_per_turn": 0, "turn_count": 0}

    turn_lengths = [len(t.split()) for t in user_turns]
    avg_words = sum(turn_lengths) / len(turn_lengths)
    turn_count = len(user_turns)

    if avg_words >= 80:
        base = 90
    elif avg_words >= 50:
        base = 75
    elif avg_words >= 30:
        base = 58
    elif avg_words >= 15:
        base = 40
    else:
        base = 25

    turn_bonus = min(10, (turn_count - 3) * 1.5) if turn_count > 3 else 0

    score = min(100, max(0, base + turn_bonus))

    return {
        "score": round(score),
        "avg_words_per_turn": round(avg_words, 1),
        "turn_count": turn_count,
    }


def _compute_coherence_score(text: str) -> dict:
    if not text.strip():
        return {"score": 50, "connector_count": 0}

    text_lower = text.lower()
    connector_count = sum(1 for dc in _DISCOURSE_CONNECTORS if f" {dc} " in f" {text_lower} ")

    words = text.split()
    total_words = max(len(words), 1)

    connector_rate = connector_count / (total_words / 50)

    if connector_rate >= 2:
        score = 90
    elif connector_rate >= 1:
        score = 75
    elif connector_rate >= 0.5:
        score = 58
    elif connector_rate >= 0.2:
        score = 42
    else:
        score = 28

    return {
        "score": round(score),
        "connector_count": connector_count,
        "connector_rate_per_50w": round(connector_rate, 2),
    }


def _compute_listening_comprehension(transcript: Optional[List[dict]]) -> dict:
    if not transcript or len(transcript) < 4:
        return {"score": 60, "relevant_responses": 0, "total_questions": 0}

    total_questions = 0
    relevant_responses = 0

    for i, entry in enumerate(transcript):
        if entry.get("role") == "assistant" and "?" in entry.get("text", ""):
            total_questions += 1
            for j in range(i + 1, min(i + 3, len(transcript))):
                if transcript[j].get("role") == "user":
                    words = len((transcript[j].get("text") or "").split())
                    if words >= 10:
                        relevant_responses += 1
                    break

    if total_questions == 0:
        return {"score": 60, "relevant_responses": 0, "total_questions": 0}

    response_rate = relevant_responses / total_questions
    score = min(100, round(response_rate * 100))

    return {
        "score": score,
        "relevant_responses": relevant_responses,
        "total_questions": total_questions,
        "response_rate": round(response_rate, 2),
    }


def _score_to_cefr(composite_score: float) -> str:
    for threshold, level in _CEFR_BANDS:
        if composite_score >= threshold:
            return level
    return "A1"


def compute_language_proficiency(
    transcript: Optional[List[dict]],
    applicant_data: Optional[Dict[str, Any]] = None,
) -> dict:
    detected_language = (applicant_data or {}).get("language_used", "english")

    text = _extract_user_text(transcript)

    grammar = _compute_grammar_score(text)
    vocabulary = _compute_vocabulary_score(text)
    fluency = _compute_fluency_score(transcript)
    coherence = _compute_coherence_score(text)
    listening = _compute_listening_comprehension(transcript)

    composite = (
        grammar["score"] * 0.25
        + vocabulary["score"] * 0.25
        + fluency["score"] * 0.20
        + coherence["score"] * 0.20
        + listening["score"] * 0.10
    )

    cefr_level = _score_to_cefr(composite)

    cefr_to_ielts = {
        "C2": "8.5-9.0",
        "C1": "7.0-8.0",
        "B2": "5.5-6.5",
        "B1": "4.0-5.0",
        "A2": "2.5-3.5",
        "A1": "1.0-2.0",
    }

    return {
        "cefr_level": cefr_level,
        "composite_score": round(composite),
        "ielts_equivalent": cefr_to_ielts.get(cefr_level, "N/A"),
        "detected_language": detected_language,
        "disclaimer": "Heuristic estimate only — not a certified assessment. ±1 CEFR band accuracy.",
        "dimensions": {
            "grammar_accuracy": grammar,
            "vocabulary_richness": vocabulary,
            "fluency": fluency,
            "coherence": coherence,
            "listening_comprehension": listening,
        },
    }
