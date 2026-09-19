from app.interview.prompts import build_system_instruction


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
