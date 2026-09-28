"""Shared LLM-rubric grading used by both Writing and Speaking (Module 3)."""

import json
import logging
import statistics
from dataclasses import dataclass, field

from app.english.config import english_settings
from app.english.infra.llm import LLMClient

logger = logging.getLogger(__name__)


async def _call_llm_safely(llm: LLMClient, system_prompt: str, user_content: str) -> str | None:
    try:
        return await llm.complete_json(system_prompt, user_content, temperature=0.0)
    except Exception as exc:
        logger.warning("LLM grading unavailable: %s", type(exc).__name__)
        return None


@dataclass
class CriterionResult:
    levels: list[int] = field(default_factory=list)
    evidence: list[str] = field(default_factory=list)

    @property
    def median(self) -> float:
        return statistics.median(self.levels) if self.levels else 0

    @property
    def disagreement(self) -> bool:
        return bool(self.levels) and (max(self.levels) - min(self.levels) >= 2)


@dataclass
class RubricGrade:
    criteria: dict[str, CriterionResult]
    invalid_runs: int
    rationale: list[str]

    @property
    def skill_level(self) -> int:
        medians = sorted(c.median for c in self.criteria.values())
        if not medians:
            return 1
        n = len(medians)
        lower_middle_idx = (n - 1) // 2
        return round(medians[lower_middle_idx])

    @property
    def any_disagreement(self) -> bool:
        return any(c.disagreement for c in self.criteria.values())


def _is_verbatim(evidence: str, source: str) -> bool:
    return bool(evidence) and evidence.strip() in source


async def grade_with_rubric(
    llm: LLMClient,
    system_prompt: str,
    user_content: str,
    criterion_names: list[str],
    source_text: str,
    runs: int | None = None,
) -> RubricGrade:
    runs = runs or english_settings.grader_runs
    criteria = {name: CriterionResult() for name in criterion_names}
    invalid_runs = 0
    rationale: list[str] = []

    for _ in range(runs):
        raw = await _call_llm_safely(llm, system_prompt, user_content)
        parsed = _parse_and_validate(raw, criterion_names, source_text) if raw is not None else None
        if parsed is None:
            raw2 = await _call_llm_safely(llm, system_prompt, user_content)
            parsed = _parse_and_validate(raw2, criterion_names, source_text) if raw2 is not None else None
        if parsed is None:
            invalid_runs += 1
            continue
        for name in criterion_names:
            criteria[name].levels.append(parsed[name]["level"])
            criteria[name].evidence.append(parsed[name]["evidence"])
        if "rationale" in parsed:
            rationale.append(parsed["rationale"])

    return RubricGrade(criteria=criteria, invalid_runs=invalid_runs, rationale=rationale)


def _parse_and_validate(raw: str, criterion_names: list[str], source_text: str) -> dict | None:
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(data, dict):
        return None
    if "rationale" in data and (not isinstance(data["rationale"], str) or len(data["rationale"]) > 2000):
        return None
    for name in criterion_names:
        entry = data.get(name)
        if not isinstance(entry, dict):
            return None
        level = entry.get("level")
        evidence = entry.get("evidence", "")
        if type(level) is not int or not (1 <= level <= 6):
            return None
        if not isinstance(evidence, str) or not _is_verbatim(evidence, source_text):
            return None
    return data
