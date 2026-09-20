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
        json={"name": "Grid Applicant", "email": email, "password": "correct-horse-battery-staple"},
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


async def _make_session(client, db_session, email):
    user_id, _ = await _register(client, email)
    session_repo = SessionRepository(db_session)
    session = await session_repo.create(SessionCreate(user_id=user_id, program="CS"))
    await session_repo.update_transcript(session.id, TRANSCRIPT)
    return session


async def test_committee_grid_rejects_non_admin(client, db_session):
    _, token = await _register(client, "not-admin@example.com")
    res = await client.get("/api/admin/committee", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


async def test_committee_grid_shows_current_row_per_indicator_and_no_overall_score(
    client, db_session, monkeypatch
):
    session = await _make_session(client, db_session, "grid1@example.com")
    rating_event_repo = RatingEventRepository(db_session)
    proposed = await rating_event_repo.create(
        RatingEventCreate(
            session_id=session.id,
            indicator=RatingIndicator.LEADERSHIP.value,
            quote="I led a team of five students to rebuild our school's robotics club.",
            band=RatingBand.DEVELOPING.value,
            rater_type=RaterType.MODEL.value,
        )
    )
    await rating_event_repo.update_status(
        proposed.id, status=RatingEventStatus.ACCEPTED.value, rater_id="admin-1", band=RatingBand.STRONG.value
    )

    admin_token = await _admin_token(client, monkeypatch, "grid-admin1@example.com")
    res = await client.get("/api/admin/committee", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    body = res.json()

    row = next(item for item in body["items"] if item["session_id"] == session.id)
    assert row["indicators"]["leadership"] == {
        "band": RatingBand.STRONG.value,
        "status": RatingEventStatus.ACCEPTED.value,
        "rater_type": RaterType.HUMAN.value,
    }
    assert row["indicators"]["motivation_university"] is None
    assert row["indicators"]["prior_experience"] is None

    body_text = str(body)
    for forbidden in ("overall_score", "\"score\"", "recommendation"):
        assert forbidden not in body_text


async def test_committee_grid_prefers_human_decision_over_a_later_model_proposal(
    client, db_session, monkeypatch
):
    session = await _make_session(client, db_session, "grid2@example.com")
    rating_event_repo = RatingEventRepository(db_session)
    proposed = await rating_event_repo.create(
        RatingEventCreate(
            session_id=session.id,
            indicator=RatingIndicator.LEADERSHIP.value,
            quote="I led a team of five students to rebuild our school's robotics club.",
            band=RatingBand.DEVELOPING.value,
            rater_type=RaterType.MODEL.value,
        )
    )
    await rating_event_repo.update_status(
        proposed.id, status=RatingEventStatus.ACCEPTED.value, rater_id="admin-1"
    )
    await rating_event_repo.create(
        RatingEventCreate(
            session_id=session.id,
            indicator=RatingIndicator.LEADERSHIP.value,
            quote="I led a team of five students to rebuild our school's robotics club.",
            band=RatingBand.EMERGING.value,
            rater_type=RaterType.MODEL.value,
        )
    )

    admin_token = await _admin_token(client, monkeypatch, "grid-admin2@example.com")
    res = await client.get("/api/admin/committee", headers={"Authorization": f"Bearer {admin_token}"})
    row = next(item for item in res.json()["items"] if item["session_id"] == session.id)
    assert row["indicators"]["leadership"]["rater_type"] == RaterType.HUMAN.value
    assert row["indicators"]["leadership"]["status"] == RatingEventStatus.ACCEPTED.value


async def test_committee_context_shows_the_full_distribution_and_transcript(client, db_session, monkeypatch):
    session = await _make_session(client, db_session, "context1@example.com")
    rating_event_repo = RatingEventRepository(db_session)
    await rating_event_repo.create(
        RatingEventCreate(
            session_id=session.id,
            indicator=RatingIndicator.LEADERSHIP.value,
            quote="I led a team of five students to rebuild our school's robotics club.",
            band=RatingBand.DEVELOPING.value,
            rater_type=RaterType.MODEL.value,
        )
    )
    await rating_event_repo.create(
        RatingEventCreate(
            session_id=session.id,
            indicator=RatingIndicator.LEADERSHIP.value,
            quote="I led a team of five students to rebuild our school's robotics club.",
            band=RatingBand.STRONG.value,
            rater_type=RaterType.MODEL.value,
        )
    )

    admin_token = await _admin_token(client, monkeypatch, "context-admin1@example.com")
    res = await client.get(
        f"/api/admin/committee/{session.id}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["session_id"] == session.id
    assert body["transcript"] == TRANSCRIPT
    assert len(body["rating_events"]["leadership"]) == 2
    assert body["rating_events"]["motivation_university"] == []


async def test_committee_context_404s_for_an_unknown_session(client, db_session, monkeypatch):
    admin_token = await _admin_token(client, monkeypatch, "context-admin2@example.com")
    res = await client.get(
        "/api/admin/committee/does-not-exist", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 404
