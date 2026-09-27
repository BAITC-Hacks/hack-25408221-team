from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import select

from app.english.domain.enums import Section, SessionState, Stage
from app.english.infra.models import Applicant, Response, TestSession
from app.english.test_engine.engine import (
    build_form,
    client_view,
    get_current_items,
    start_next_section,
    submit_answers,
)


@pytest.fixture
async def applicant(db_session):
    a = Applicant(external_id="e-1", full_name="Test", email="t@t.com")
    db_session.add(a)
    await db_session.commit()
    await db_session.refresh(a)
    return a


@pytest.fixture
async def ts(db_session, applicant, loaded_items):
    session = TestSession(applicant_id=applicant.id)
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    await build_form(db_session, session)
    return session


async def test_build_form_populates_all_sections(ts):
    assert len(ts.form["listening"]["routing"]) == 2
    assert len(ts.form["reading"]["routing"]) == 1
    assert len(ts.form["writing"]["items"]) == 1
    assert len(ts.form["speaking"]["items"]) == 3


async def test_client_view_never_leaks_answers(db_session, ts):
    await start_next_section(db_session, ts)
    items, stage = await get_current_items(db_session, ts)
    view = client_view(items)
    dumped = str(view)
    assert "answer" not in dumped
    assert "accept" not in dumped
    assert "transcript" not in dumped


async def test_listening_routes_to_hard_on_strong_routing_answers(db_session, ts):
    await start_next_section(db_session, ts)  # -> listening, routing stage
    items, stage = await get_current_items(db_session, ts)
    assert stage == Stage.ROUTING
    assert {i.id for i in items} == {"L-RT-001", "L-RT-002"}

    answers = [
        {"item_id": "L-RT-001", "answer": {"q1": 1, "q2": "month"}},
        {"item_id": "L-RT-002", "answer": {"q1": 1, "q2": "six"}},
    ]
    result = await submit_answers(db_session, ts, answers)
    assert result["section_complete"] is False
    assert result["stage"] == "hard"
    stage2_ids = {i["id"] for i in result["items"]}
    assert stage2_ids == {"L-HD-001", "L-HD-002"}

    # Finish stage2 with correct answers -> section advances to reading.
    stage2_answers = [
        {"item_id": "L-HD-001", "answer": {"q1": 1, "q2": "six"}},
        {"item_id": "L-HD-002", "answer": {"q1": 1, "q2": "promising"}},
    ]
    result2 = await submit_answers(db_session, ts, stage2_answers)
    assert result2["section_complete"] is True
    assert result2["next_section"] == "reading"


async def test_listening_routes_to_easy_on_weak_routing_answers(db_session, ts):
    await start_next_section(db_session, ts)
    answers = [
        {"item_id": "L-RT-001", "answer": {"q1": 0, "q2": "wrong"}},
        {"item_id": "L-RT-002", "answer": {"q1": 0, "q2": "wrong"}},
    ]
    result = await submit_answers(db_session, ts, answers)
    assert result["stage"] == "easy"
    assert {i["id"] for i in result["items"]} == {"L-EZ-001", "L-EZ-002"}


async def test_reading_ctest_then_passage(db_session, ts):
    await start_next_section(db_session, ts)  # listening
    await submit_answers(
        db_session, ts, [
            {"item_id": "L-RT-001", "answer": {"q1": 1, "q2": "month"}},
            {"item_id": "L-RT-002", "answer": {"q1": 1, "q2": "six"}},
        ],
    )
    await submit_answers(
        db_session, ts, [
            {"item_id": "L-HD-001", "answer": {"q1": 1, "q2": "six"}},
            {"item_id": "L-HD-002", "answer": {"q1": 1, "q2": "promising"}},
        ],
    )  # -> reading

    items, stage = await get_current_items(db_session, ts)
    assert stage == Stage.ROUTING
    assert items[0].id == "R-CT-001"

    result = await submit_answers(
        db_session, ts,
        [{"item_id": "R-CT-001", "answer": {"segments": ["ew", "ory", "ple", "nd", "ing", "se"]}}],
    )
    assert result["stage"] == "hard"
    assert result["items"][0]["id"] == "R-P-HD-001"

    result2 = await submit_answers(
        db_session, ts,
        [{"item_id": "R-P-HD-001", "answer": {"q1": 1, "q2": "true", "q3": 1, "q4": "not_given"}}],
    )
    assert result2["section_complete"] is True
    assert result2["next_section"] == "writing"


async def test_writing_single_stage_advances_to_speaking(db_session, ts):
    await start_next_section(db_session, ts)  # listening
    await submit_answers(db_session, ts, [
        {"item_id": "L-RT-001", "answer": {"q1": 1, "q2": "month"}},
        {"item_id": "L-RT-002", "answer": {"q1": 1, "q2": "six"}},
    ])
    await submit_answers(db_session, ts, [
        {"item_id": "L-HD-001", "answer": {"q1": 1, "q2": "six"}},
        {"item_id": "L-HD-002", "answer": {"q1": 1, "q2": "promising"}},
    ])  # -> reading
    await submit_answers(db_session, ts, [
        {"item_id": "R-CT-001", "answer": {"segments": ["ew", "ory", "ple", "nd", "ing", "se"]}},
    ])
    await submit_answers(db_session, ts, [
        {"item_id": "R-P-HD-001", "answer": {"q1": 1, "q2": "true", "q3": 1, "q4": "not_given"}},
    ])  # -> writing

    items, stage = await get_current_items(db_session, ts)
    writing_item = items[0]
    result = await submit_answers(
        db_session, ts, [{"item_id": writing_item.id, "answer": "This is my essay about the topic."}]
    )
    assert result["section_complete"] is True
    assert result["next_section"] == "speaking"


async def test_submit_past_deadline_still_advances_instead_of_getting_stuck(db_session, ts):
    """Regression test: a submit after the deadline+grace used to raise and
    permanently block the applicant from ever finishing the section, since
    every retry hit the same expired deadline. It must still succeed and
    advance without giving credit for late answers."""
    await start_next_section(db_session, ts)  # listening

    past = datetime.now(timezone.utc) - timedelta(seconds=10)
    ts.section_deadline = {**ts.section_deadline, "listening": past.isoformat()}
    db_session.add(ts)
    await db_session.commit()

    result = await submit_answers(db_session, ts, [
        {"item_id": "L-RT-001", "answer": {"q1": 1, "q2": "month"}},
        {"item_id": "L-RT-002", "answer": {"q1": 1, "q2": "six"}},
    ])
    assert result["section_complete"] is True
    assert result["next_section"] == "reading"
    assert result["expired"] is True

    stored = (
        await db_session.execute(select(Response).where(Response.item_id == "L-RT-001"))
    ).scalars().first()
    assert stored is None
