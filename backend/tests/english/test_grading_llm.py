import json

import pytest

from app.english.grading.speaking import grade_speaking
from app.english.grading.writing import grade_writing
from app.english.infra.asr import FakeASRClient
from app.english.infra.languagetool import FakeLanguageToolClient
from app.english.infra.llm import FakeLLMClient


ESSAY = (
    "I believe universities should look at more than exam results. Grades show "
    "knowledge, but they do not show creativity, teamwork, or resilience. For "
    "example, a student who struggled with exams but led a community project "
    "may bring more value to a university than someone with perfect grades. "
    "Therefore, I disagree with judging applicants only on exams."
)

_GOOD_WRITING_RESPONSE = json.dumps(
    {
        "task_achievement": {"level": 4, "evidence": "I disagree with judging applicants only on exams."},
        "coherence": {"level": 4, "evidence": "For example, a student who struggled with exams"},
        "vocabulary": {"level": 4, "evidence": "creativity, teamwork, or resilience"},
        "grammar": {"level": 4, "evidence": "Grades show knowledge"},
        "rationale": "Clear, well-organized opinion essay.",
    }
)


async def test_grade_writing_happy_path():
    llm = FakeLLMClient(script=[_GOOD_WRITING_RESPONSE] * 3)
    lt = FakeLanguageToolClient(errors_per_100=2.0)
    grade = await grade_writing(ESSAY, "Do you agree?", llm, lt)
    assert grade["level"] == 4
    assert "too_short" not in grade["flags"]
    assert "grader_disagreement" not in grade["flags"]
    assert grade["features"]["word_count"] > 50


async def test_grade_writing_too_short_caps_level():
    llm = FakeLLMClient(script=[_GOOD_WRITING_RESPONSE] * 3)
    lt = FakeLanguageToolClient()
    grade = await grade_writing("Too short essay.", "Prompt", llm, lt)
    assert grade["level"] <= 2
    assert "too_short" in grade["flags"]


async def test_grade_writing_invalid_evidence_retried_then_invalid():
    bad = json.dumps(
        {
            "task_achievement": {"level": 4, "evidence": "not in the essay at all"},
            "coherence": {"level": 4, "evidence": "not in the essay at all"},
            "vocabulary": {"level": 4, "evidence": "not in the essay at all"},
            "grammar": {"level": 4, "evidence": "not in the essay at all"},
        }
    )
    llm = FakeLLMClient(script=[bad] * 6)  # 3 runs x (1 try + 1 retry) all invalid
    lt = FakeLanguageToolClient()
    grade = await grade_writing(ESSAY, "Prompt", llm, lt)
    assert "grade_invalid" in grade["flags"]


async def test_grade_writing_disagreement_flagged():
    responses = []
    for level in (2, 6):  # span 4 across two runs -> disagreement
        responses.append(
            json.dumps(
                {
                    "task_achievement": {"level": level, "evidence": "I disagree with judging applicants only on exams."},
                    "coherence": {"level": 4, "evidence": "For example, a student who struggled with exams"},
                    "vocabulary": {"level": 4, "evidence": "creativity, teamwork, or resilience"},
                    "grammar": {"level": 4, "evidence": "Grades show knowledge"},
                }
            )
        )
    llm = FakeLLMClient(script=[responses[0], responses[1], responses[0]])
    lt = FakeLanguageToolClient()
    grade = await grade_writing(ESSAY, "Prompt", llm, lt)
    assert "grader_disagreement" in grade["flags"]


_SPEAKING_RESPONSE = json.dumps(
    {
        "fluency": {"level": 4, "evidence": "I would like to visit Japan"},
        "range": {"level": 4, "evidence": "I would like to visit Japan"},
        "accuracy": {"level": 4, "evidence": "I would like to visit Japan"},
        "coherence": {"level": 4, "evidence": "I would like to visit Japan"},
        "task_fulfilment": {"level": 4, "evidence": "I would like to visit Japan"},
        "rationale": "Fluent and clear.",
    }
)


async def test_grade_speaking_happy_path():
    asr = FakeASRClient(
        default={
            "text": "I would like to visit Japan because of its culture and food.",
            "words": [
                {"word": w, "start": i * 0.4, "end": i * 0.4 + 0.3, "confidence": 0.95}
                for i, w in enumerate("I would like to visit Japan because of its culture and food".split())
            ],
            "duration_s": 5.0,
        }
    )
    llm = FakeLLMClient(script=[_SPEAKING_RESPONSE] * 3)
    answers = [
        {"task": "personal", "audio_path": "a.wav", "prompt": "Tell me about a place..."},
        {"task": "picture", "audio_path": "b.wav", "prompt": "Describe the picture."},
        {"task": "opinion", "audio_path": "c.wav", "prompt": "City or town?"},
    ]
    grade = await grade_speaking(answers, asr, llm)
    assert grade["level"] == 4
    assert not any("no_response" in f for f in grade["flags"])


async def test_grade_speaking_flags_no_response():
    asr = FakeASRClient(default={"text": "", "words": [], "duration_s": 0.0})
    llm = FakeLLMClient(script=[_SPEAKING_RESPONSE] * 3)
    answers = [{"task": "personal", "audio_path": "a.wav", "prompt": "..."}]
    grade = await grade_speaking(answers, asr, llm)
    assert any("no_response" in f for f in grade["flags"])
