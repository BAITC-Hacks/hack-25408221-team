from app.config import settings
from app.domain.entities import RatingEventCreate, SessionCreate
from app.domain.enums import RaterType, RatingBand, RatingEventStatus, RatingIndicator
from app.infrastructure.repositories import RatingEventRepository, SessionRepository

TRANSCRIPT = [
    {"role": "assistant", "text": "Tell me about a time you led a team."},
    {"role": "user", "text": "I led a team of five students to rebuild our school's robotics club."},
]


async def _register(client, email):
    res = await client.post(
        "/api/register",
        json={"name": "Test User", "email": email, "password": "correct-horse-battery-staple"},
    )
    assert res.status_code == 200
    body = res.json()
    return body["userId"], body["accessToken"]


async def _admin_token(client, monkeypatch, email):
    monkeypatch.setattr(settings, "admin_creation_secret", "test-admin-secret")
    await client.post(
        "/api/admin/create-admin",
        json={"email": email, "password": "admin-password", "secret": "test-admin-secret"},
    )
    login_res = await client.post("/api/login", json={"email": email, "password": "admin-password"})
    assert login_res.status_code == 200
    return login_res.json()["accessToken"]


async def _make_session_with_proposed_event(client, db_session, email):
    user_id, _ = await _register(client, email)
    session_repo = SessionRepository(db_session)
    session = await session_repo.create(SessionCreate(user_id=user_id, program="CS"))
    await session_repo.update_transcript(session.id, TRANSCRIPT)
    event = await RatingEventRepository(db_session).create(
        RatingEventCreate(
            session_id=session.id,
            indicator=RatingIndicator.LEADERSHIP.value,
            quote="I led a team of five students to rebuild our school's robotics club.",
            band=RatingBand.DEVELOPING.value,
            rater_type=RaterType.MODEL.value,
        )
    )
    return session, event


async def test_decide_rejects_non_admin(client, db_session):
    session, event = await _make_session_with_proposed_event(client, db_session, "applicant1@example.com")
    _, token = await _register(client, "not-admin@example.com")
    res = await client.post(
        f"/api/admin/sessions/{session.id}/rating-events/{event.id}/decide",
        json={"status": "accepted"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


async def test_decide_accepts_and_makes_the_row_a_durable_human_decision(client, db_session, monkeypatch):
    session, event = await _make_session_with_proposed_event(client, db_session, "applicant2@example.com")
    admin_token = await _admin_token(client, monkeypatch, "admin1@example.com")

    res = await client.post(
        f"/api/admin/sessions/{session.id}/rating-events/{event.id}/decide",
        json={"status": "accepted"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == RatingEventStatus.ACCEPTED.value
    assert body["rater_type"] == RaterType.HUMAN.value
    assert body["rater_id"] is not None


async def test_decide_rejects_a_hand_edited_quote_not_found_in_the_transcript(client, db_session, monkeypatch):
    session, event = await _make_session_with_proposed_event(client, db_session, "applicant3@example.com")
    admin_token = await _admin_token(client, monkeypatch, "admin2@example.com")

    res = await client.post(
        f"/api/admin/sessions/{session.id}/rating-events/{event.id}/decide",
        json={"status": "accepted", "quote": "I invented this quote."},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400


async def test_decide_rejects_an_unknown_status(client, db_session, monkeypatch):
    session, event = await _make_session_with_proposed_event(client, db_session, "applicant4@example.com")
    admin_token = await _admin_token(client, monkeypatch, "admin3@example.com")

    res = await client.post(
        f"/api/admin/sessions/{session.id}/rating-events/{event.id}/decide",
        json={"status": "proposed"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400


async def test_decide_404s_when_the_event_does_not_belong_to_the_session(client, db_session, monkeypatch):
    _session_a, event_a = await _make_session_with_proposed_event(client, db_session, "applicant5@example.com")
    session_b, _ = await _make_session_with_proposed_event(client, db_session, "applicant6@example.com")
    admin_token = await _admin_token(client, monkeypatch, "admin4@example.com")

    res = await client.post(
        f"/api/admin/sessions/{session_b.id}/rating-events/{event_a.id}/decide",
        json={"status": "accepted"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 404
