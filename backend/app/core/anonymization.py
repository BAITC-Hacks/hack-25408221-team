
import re
from typing import Any, Dict, List, Optional

EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERN = re.compile(r"\b(\+?[\d\s\-\(\)]{7,15})\b")


def anonymize_text(text: str) -> str:
    text = EMAIL_PATTERN.sub("[EMAIL]", text)
    text = PHONE_PATTERN.sub("[PHONE]", text)
    return text


def anonymize_transcript(transcript: Optional[List[dict]]) -> Optional[List[dict]]:
    if not transcript:
        return transcript
    result = []
    for entry in transcript:
        clean = dict(entry)
        if "text" in clean and isinstance(clean["text"], str):
            clean["text"] = anonymize_text(clean["text"])
        result.append(clean)
    return result


def anonymize_applicant_data(applicant_data: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not applicant_data:
        return applicant_data
    text_fields = [
        "q1_why_applying",
        "q2_program_choice",
        "q3_challenge_overcome",
        "q4_long_term_goals",
        "q5_leadership",
        "q6_family_support",
    ]
    result = dict(applicant_data)
    for field in text_fields:
        if field in result and isinstance(result[field], str):
            result[field] = anonymize_text(result[field])
    return result
