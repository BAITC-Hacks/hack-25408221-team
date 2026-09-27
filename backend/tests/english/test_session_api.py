import json

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.english.grading.run import grade_session
from app.english.infra.models import Applicant, TestSession
from app.english.infra.llm import FakeLLMClient

GATES_OK = {
    "browser_ok": True,
    "camera_mic_ok": True,
    "screen_share_monitor": True,
    "not_extended": True,
    "fullscreen": True,
    "single_face_confirmed": True,
}


async def _applicant_headers(client, platform_headers, external_id="s-app-1"):
    resp = await client.post(
        "/applicants",
        json={"external_id": external_id, "full_name": "S App", "email": "s@a.com"},
        headers=platform_headers,
    )
    body = resp.json()
    return body["id"], {"Authorization": f"Bearer {body['token']}"}


async def test_create_session_requires_auth(client):
    resp = await client.post("/sessions")
    assert resp.status_code == 401


async def test_checkin_blocks_until_all_gates_pass(client, platform_headers, loaded_items):
    _, headers = await _applicant_headers(client, platform_headers)
    create = await client.post("/sessions", headers=headers)
    assert create.status_code == 200
    session_id = create.json()["session_id"]

    bad_gates = dict(GATES_OK)
    bad_gates["fullscreen"] = False
    resp = await client.post(f"/sessions/{session_id}/checkin", json={"gates": bad_gates, "consent": True}, headers=headers)
    assert resp.json()["passed"] is False
    assert "fullscreen" in resp.json()["missing"]

    resp2 = await client.post(f"/sessions/{session_id}/checkin", json={"gates": GATES_OK, "consent": True}, headers=headers)
    body = resp2.json()
    assert body["passed"] is True
    assert body["section"] == "listening"
    assert body["stage"] == "routing"
    assert len(body["items"]) == 2


async def test_second_session_rejected_after_max_attempts(client, platform_headers, loaded_items):
    _, headers = await _applicant_headers(client, platform_headers, "s-app-2")
    first = await client.post("/sessions", headers=headers)
    assert first.status_code == 200
    second = await client.post("/sessions", headers=headers)
    assert second.status_code == 409


async def test_answers_rejected_for_wrong_section(client, platform_headers, loaded_items):
    _, headers = await _applicant_headers(client, platform_headers, "s-app-3")
    create = await client.post("/sessions", headers=headers)
    session_id = create.json()["session_id"]
    # No checkin yet -> current_section is None -> answers endpoint should conflict.
    resp = await client.post(
        f"/sessions/{session_id}/answers",
        json={"answers": [{"item_id": "L-RT-001", "answer": {"q1": 1}}]},
        headers=headers,
    )
    assert resp.status_code == 409


async def test_admin_login_and_queue(client, platform_headers, loaded_items):
    login = await client.post(
        "/admin/login", json={"email": "admin@invision.demo", "password": "admin123"}
    )
    assert login.status_code == 200
    token = login.json()["token"]
    admin_headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/admin/queue", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json() == {"sessions": [], "ielts_checks": []}


async def test_admin_login_wrong_password(client):
    resp = await client.post("/admin/login", json={"email": "admin@invision.demo", "password": "wrong"})
    assert resp.status_code == 401


async def test_grade_session_bachelor_and_webhook(db_session, loaded_items, fake_webhook, tmp_path, monkeypatch):
    from app.english.config import english_settings as settings
    from app.english.infra.models import ProctorEvent
    monkeypatch.setattr(settings, "auto_placement_enabled", True)
    """Drives the whole session through the engine directly (fast, deterministic),
    then grades it with a scripted LLM that always returns a strong B2 grade, and
    checks the webhook fires with the BACHELOR placement."""
    from app.english.test_engine.engine import build_form, start_next_section, submit_answers

    applicant = Applicant(external_id="grade-1", full_name="Grade Test", email="g@g.com")
    db_session.add(applicant)
    await db_session.commit()
    await db_session.refresh(applicant)

    ts = TestSession(applicant_id=applicant.id)
    db_session.add(ts)
    await db_session.commit()
    await db_session.refresh(ts)
    await build_form(db_session, ts)

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

    from app.english.test_engine.engine import get_current_items

    items, _ = await get_current_items(db_session, ts)
    writing_item_id = items[0].id
    await submit_answers(
        db_session, ts,
        [{"item_id": writing_item_id, "answer": "A long essay with many words " * 10}],
    )  # -> speaking

    # Manually record speaking responses (bypassing the media endpoint/HTTP layer).
    from app.english.domain.enums import Section, Stage
    from app.english.infra.models import Response

    speaking_ids = ts.form["speaking"]["items"]
    for item_id in speaking_ids:
        db_session.add(
            Response(
                session_id=ts.id, item_id=item_id, section=Section.SPEAKING, stage=Stage.SINGLE,
                media_path=f"fake/{item_id}.wav",
            )
        )
    await db_session.commit()

    strong_writing = json.dumps({
        "task_achievement": {"level": 4, "evidence": "many words"},
        "coherence": {"level": 4, "evidence": "many words"},
        "vocabulary": {"level": 4, "evidence": "many words"},
        "grammar": {"level": 4, "evidence": "many words"},
    })
    strong_speaking = json.dumps({
        "fluency": {"level": 4, "evidence": "I would like to visit Japan"},
        "range": {"level": 4, "evidence": "I would like to visit Japan"},
        "accuracy": {"level": 4, "evidence": "I would like to visit Japan"},
        "coherence": {"level": 4, "evidence": "I would like to visit Japan"},
        "task_fulfilment": {"level": 4, "evidence": "I would like to visit Japan"},
    })
    from app.english.infra.asr import FakeASRClient
    from app.english.infra.languagetool import FakeLanguageToolClient

    llm = FakeLLMClient(script=lambda system, user: strong_writing if "task_achievement" in system else strong_speaking)
    words = "I would like to visit Japan because of its culture and food".split()
    asr = FakeASRClient(
        default={
            "text": "I would like to visit Japan because of its culture and food.",
            "words": [
                {"word": w, "start": i * 0.4, "end": i * 0.4 + 0.3, "confidence": 0.95}
                for i, w in enumerate(words)
            ],
            "duration_s": 5.0,
        }
    )
    lt = FakeLanguageToolClient()

    from app.english.infra.storage import LocalStorage

    storage = LocalStorage(root=str(tmp_path))
    db_session.add(ProctorEvent(session_id=ts.id, seq=1, type="heartbeat"))
    await db_session.commit()
    ts = await grade_session(
        db_session, ts, llm=llm, asr=asr, languagetool=lt, webhook=fake_webhook, storage=storage
    )

    assert ts.levels["listening"] == 5  # hard, 4/4 correct
    assert ts.levels["reading"] == 5  # hard, 4/4 correct
    assert ts.levels["writing"] == 4
    assert ts.levels["speaking"] == 4
    placement_val = ts.placement.value if hasattr(ts.placement, "value") else str(ts.placement)
    assert placement_val == "BACHELOR"
    state_val = ts.state.value if hasattr(ts.state, "value") else str(ts.state)
    assert state_val == "decided"
    assert len(fake_webhook.sent) == 1
    assert fake_webhook.sent[0]["placement"] == "BACHELOR"


async def test_current_session_is_owned_and_checkin_resumes(client, platform_headers, loaded_items):
    _, headers = await _applicant_headers(client, platform_headers, "resume-owner")
    _, other = await _applicant_headers(client, platform_headers, "resume-other")
    assert (await client.get("/sessions/current", headers=headers)).json() is None
    created = (await client.post("/sessions", headers=headers)).json()
    assert (await client.get("/sessions/current", headers=headers)).json() == created
    assert (await client.get("/sessions/current", headers=other)).json() is None
    url = f"/sessions/{created['session_id']}/checkin"
    first = await client.post(url, json={"gates": GATES_OK, "consent": True}, headers=headers)
    second = await client.post(url, json={"gates": GATES_OK, "consent": True}, headers=headers)
    assert first.json() == second.json()
    assert (await client.post(url, json={"gates": GATES_OK, "consent": True}, headers=other)).status_code == 404
