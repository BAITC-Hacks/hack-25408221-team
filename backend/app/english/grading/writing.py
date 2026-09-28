"""Module 3: Writing grading. LLM rubric + cheap feature sanity checks."""

from pathlib import Path

from app.english.grading.features import mattr, word_count
from app.english.grading.llm_rubric import grade_with_rubric
from app.english.infra.languagetool import LanguageToolClient
from app.english.infra.llm import LLMClient

_PROMPT_PATH = Path(__file__).parent / "prompts" / "writing_rubric.md"
CRITERIA = ["task_achievement", "coherence", "vocabulary", "grammar"]


async def grade_writing(essay: str, prompt: str, llm: LLMClient, languagetool: LanguageToolClient) -> dict:
    system = _PROMPT_PATH.read_text()
    user = f"Prompt: {prompt}\n\nEssay:\n{essay}"

    grade = await grade_with_rubric(llm, system, user, CRITERIA, essay)

    wc = word_count(essay)
    lt_errors = await languagetool.error_count(essay)
    lt_errors_per_100 = (lt_errors / wc * 100) if wc else 0.0
    lexical_diversity = mattr(essay)

    level = grade.skill_level
    flags = []
    if wc < 50:
        level = min(level, 2)  # cap at A2
        flags.append("too_short")
    if grade.invalid_runs:
        flags.append("partial_grading")
    if grade.any_disagreement:
        flags.append("grader_disagreement")
    grammar_level = round(grade.criteria["grammar"].median) if grade.criteria.get("grammar") else 0
    if lt_errors_per_100 > 10 and grammar_level >= 4:
        flags.append("feature_conflict")
    if grade.invalid_runs >= len(grade.criteria) or not any(c.levels for c in grade.criteria.values()):
        flags.append("grade_invalid")

    return {
        "level": level,
        "criteria": {
            name: {"median": c.median, "levels": c.levels, "evidence": c.evidence}
            for name, c in grade.criteria.items()
        },
        "features": {
            "word_count": wc,
            "lt_errors_per_100": round(lt_errors_per_100, 2),
            "lexical_diversity": round(lexical_diversity, 3),
        },
        "flags": flags,
        "rationale": grade.rationale,
    }
