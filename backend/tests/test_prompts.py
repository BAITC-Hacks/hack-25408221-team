from app.interview.prompts import build_system_instruction
from app.use_cases.analyze_session_use_case import ANALYSIS_PROMPT


def test_system_instruction_forbids_scoring_on_fluency_or_family_support():
    """SPEC Section 1 (scoring core): background never enters a score, and
    fluency/grammar/vocabulary/accent never enter competency scores. Locks
    the contract that the live-interview prompt explicitly forbids the model
    from weighting communication_quality/confidence_level/family support
    into overall_score or recommendation -- we can't unit-test Gemini's
    actual behavior, so this pins the instruction text instead."""
    text = build_system_instruction(300)
    assert "never be influenced by" in text
    assert "communication_quality, confidence_level, accent, grammar, vocabulary, or fluency" in text
    assert "family/support situation" in text


def test_analysis_prompt_forbids_scoring_on_fluency_or_family_support():
    """Same contract as above, for the post-hoc transcript analysis path
    (AnalyzeSessionUseCase) rather than the live-interview prompt."""
    assert "must never" in ANALYSIS_PROMPT
    assert "confidence_level, communication_quality, accent, grammar, vocabulary" in ANALYSIS_PROMPT
    assert "q6_family_support" in ANALYSIS_PROMPT


def test_system_instruction_reflects_configured_duration():
    """B13: the prompt's stated Phase 1 time budget must track
    settings.max_interview_duration instead of a hardcoded '5-6 minutes',
    or the model paces itself against a number that doesn't match the
    server's actual timeout (handler.py's asyncio.wait_for)."""
    text_5min = build_system_instruction(300)
    assert "~5 minutes total" in text_5min
    assert "5-6 minutes" not in text_5min

    text_10min = build_system_instruction(600)
    assert "~10 minutes total" in text_10min
