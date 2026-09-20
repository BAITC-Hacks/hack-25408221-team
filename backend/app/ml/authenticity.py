
import re
from typing import Any, Dict, List, Optional


_SPECIFIC_PATTERNS = [
    r"\b\d{4}\b",
    r"\b\d+\s*(students?|people|members?|schools?|teams?)\b",
    r"\b(my|our)\s+\w+\s+(teacher|mother|father|friend|mentor|professor)\b",
    r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\b",
    r"\b(almaty|astana|bishkek|tashkent|moscow|london|new york|seoul)\b",
    r"\b(first|second|third)\s+place\b",
    r"\b(won|won the|placed|ranked)\b",
    r"\bmy\s+(school|university|city|country|neighborhood)\b",
]

_GENERIC_PHRASES = [
    "aligns perfectly with my goals",
    "aligns with my passion",
    "best environment for me to grow",
    "this program is the perfect fit",
    "i am passionate about",
    "i have always been passionate",
    "i strongly believe",
    "i am highly motivated",
    "i am dedicated to",
    "this opportunity would allow me to",
    "i am committed to",
    "i look forward to contributing",
    "excellent reputation",
    "world-class education",
    "cutting-edge curriculum",
    "i am eager to",
    "i am excited to",
    "unique opportunity",
    "my dream is to",
]


_FILLER_WORDS = [
    "um", "uh", "hmm", "well", "you know", "i mean", "like",
    "sort of", "kind of", "basically", "actually", "honestly",
    "let me think", "how to say", "i guess", "i suppose",
    "ну", "вот", "как бы", "короче", "типа", "значит", "эм",
]

_SELF_CORRECTION_PATTERNS = [
    r"\b(i mean|what i meant|or rather|actually|well,)\b",
    r"\b(no wait|let me rephrase|sorry|i should say)\b",
]


_SELF_ORIENTED = [
    "i want to get", "i need", "for my career", "i will earn",
    "i will achieve", "my success", "i will become famous",
    "to be successful", "to make money", "for my future",
    "to get a good job", "for my benefit",
]

_OTHER_ORIENTED = [
    "i want to help", "build for others", "our community", "give back",
    "serve", "contribute to", "create for", "benefit society",
    "help people", "improve lives", "for my country", "for my region",
    "support my family", "inspire others", "make a difference",
    "помочь", "вклад", "сообщество", "служить", "поддержать",
    "для страны", "для людей", "изменить",
]


def _get_all_text(applicant_data: Optional[Dict[str, Any]], transcript: Optional[List[dict]]) -> str:
    parts: List[str] = []

    if applicant_data:
        for key in ["q1_why_applying", "q2_program_choice", "q3_challenge_overcome",
                    "q4_long_term_goals", "q5_leadership", "q6_family_support"]:
            val = applicant_data.get(key, "")
            if val:
                parts.append(str(val))

    if transcript:
        for entry in transcript:
            if entry.get("role") == "user" and entry.get("text"):
                parts.append(entry["text"])

    return " ".join(parts).lower()


def compute_specificity_score(applicant_data: Optional[Dict[str, Any]], transcript: Optional[List[dict]]) -> dict:
    text = _get_all_text(applicant_data, transcript)
    if not text.strip():
        return {"specificity_score": 0, "specific_hits": 0, "generic_hits": 0, "level": "unknown"}

    specific_hits = sum(
        len(re.findall(pattern, text, re.IGNORECASE))
        for pattern in _SPECIFIC_PATTERNS
    )

    generic_hits = sum(
        1 for phrase in _GENERIC_PHRASES if phrase in text
    )

    raw = (specific_hits * 8) - (generic_hits * 12)
    score = max(0, min(100, 50 + raw))

    if score >= 70:
        level = "high"
    elif score >= 40:
        level = "medium"
    else:
        level = "low"

    return {
        "specificity_score": round(score),
        "specific_hits": specific_hits,
        "generic_hits": generic_hits,
        "level": level,
    }


def compute_linguistic_signals(transcript: Optional[List[dict]]) -> dict:
    if not transcript:
        return {
            "filler_rate": 0.0,
            "self_correction_rate": 0.0,
            "sentence_length_variance": 0.0,
            "naturalness_score": 50,
        }

    user_texts = [e["text"] for e in transcript if e.get("role") == "user" and e.get("text")]
    if not user_texts:
        return {
            "filler_rate": 0.0,
            "self_correction_rate": 0.0,
            "sentence_length_variance": 0.0,
            "naturalness_score": 50,
        }

    combined = " ".join(user_texts).lower()
    total_words = len(combined.split())
    if total_words == 0:
        return {
            "filler_rate": 0.0,
            "self_correction_rate": 0.0,
            "sentence_length_variance": 0.0,
            "naturalness_score": 50,
        }

    filler_count = sum(
        combined.count(f" {fw} ") + combined.count(f" {fw},")
        for fw in _FILLER_WORDS
    )
    filler_rate = round(filler_count / total_words, 3)

    correction_count = sum(
        len(re.findall(pattern, combined, re.IGNORECASE))
        for pattern in _SELF_CORRECTION_PATTERNS
    )
    self_correction_rate = round(correction_count / total_words, 3)

    sentences = re.split(r"[.!?]", combined)
    sentence_lengths = [len(s.split()) for s in sentences if len(s.split()) > 2]
    if len(sentence_lengths) >= 3:
        mean_len = sum(sentence_lengths) / len(sentence_lengths)
        variance = sum((l - mean_len) ** 2 for l in sentence_lengths) / len(sentence_lengths)
    else:
        variance = 0.0

    naturalness = 50
    if filler_rate > 0.005:
        naturalness += 15
    if self_correction_rate > 0.002:
        naturalness += 15
    if variance > 15:
        naturalness += 20
    if filler_rate == 0 and self_correction_rate == 0:
        naturalness -= 20

    return {
        "filler_rate": filler_rate,
        "self_correction_rate": self_correction_rate,
        "sentence_length_variance": round(variance, 1),
        "naturalness_score": max(0, min(100, naturalness)),
    }


def compute_cross_session_similarity(
    applicant_data: Optional[Dict[str, Any]],
    all_sessions: Optional[List[Dict[str, Any]]] = None,
) -> dict:
    if not applicant_data or not all_sessions or len(all_sessions) < 5:
        return {"similar_sessions": 0, "flag": False, "note": "insufficient_data"}

    def ngrams(text: str, n: int = 5) -> set:
        words = text.lower().split()
        return {" ".join(words[i:i + n]) for i in range(len(words) - n + 1)}

    this_q1 = str(applicant_data.get("q1_why_applying", ""))
    this_ngrams = ngrams(this_q1)
    if len(this_ngrams) < 3:
        return {"similar_sessions": 0, "flag": False, "note": "answer_too_short"}

    similar_count = 0
    for sess in all_sessions:
        other_data = sess.get("applicant_data") or {}
        other_q1 = str(other_data.get("q1_why_applying", ""))
        other_ngrams = ngrams(other_q1)
        if not other_ngrams:
            continue
        overlap = len(this_ngrams & other_ngrams) / len(this_ngrams)
        if overlap > 0.6:
            similar_count += 1

    flag = similar_count >= 3
    return {
        "similar_sessions": similar_count,
        "flag": flag,
        "note": "high_phrase_overlap_detected" if flag else "ok",
    }


def compute_contribution_orientation(applicant_data: Optional[Dict[str, Any]]) -> dict:
    if not applicant_data:
        return {"contribution_ratio": 0.5, "orientation": "unknown", "self_signals": 0, "other_signals": 0}

    text_parts = []
    for key in ["q1_why_applying", "q4_long_term_goals", "q5_leadership"]:
        val = applicant_data.get(key, "")
        if val:
            text_parts.append(str(val).lower())
    text = " ".join(text_parts)

    self_signals = sum(1 for phrase in _SELF_ORIENTED if phrase in text)
    other_signals = sum(1 for phrase in _OTHER_ORIENTED if phrase in text)

    total = self_signals + other_signals
    if total == 0:
        ratio = 0.5
        orientation = "neutral"
    else:
        ratio = round(other_signals / total, 2)
        if ratio >= 0.6:
            orientation = "other_focused"
        elif ratio <= 0.3:
            orientation = "self_focused"
        else:
            orientation = "balanced"

    return {
        "contribution_ratio": ratio,
        "orientation": orientation,
        "self_signals": self_signals,
        "other_signals": other_signals,
    }


def compute_authenticity_score(
    applicant_data: Optional[Dict[str, Any]],
    transcript: Optional[List[dict]],
    all_sessions: Optional[List[Dict[str, Any]]] = None,
) -> dict:
    specificity = compute_specificity_score(applicant_data, transcript)
    linguistic = compute_linguistic_signals(transcript)
    cross_sim = compute_cross_session_similarity(applicant_data, all_sessions)
    contribution = compute_contribution_orientation(applicant_data)

    base_score = (
        specificity["specificity_score"] * 0.40
        + linguistic["naturalness_score"] * 0.40
    )

    cross_penalty = 25 if cross_sim["flag"] else 0

    authenticity_score = max(0, min(100, round(base_score - cross_penalty)))

    if authenticity_score >= 65:
        risk_level = "low"
    elif authenticity_score >= 40:
        risk_level = "medium"
    else:
        risk_level = "high"

    flags = []
    if specificity["level"] == "low":
        flags.append("generic_language_detected")
    if linguistic["naturalness_score"] < 40:
        flags.append("scripted_speech_pattern")
    if cross_sim["flag"]:
        flags.append("high_cross_session_similarity")
    if specificity["generic_hits"] >= 4:
        flags.append("multiple_coached_phrases")

    return {
        "authenticity_score": authenticity_score,
        "risk_level": risk_level,
        "flags": flags,
        "specificity": specificity,
        "linguistic_signals": linguistic,
        "cross_session_similarity": cross_sim,
        "contribution_orientation": contribution,
    }
