import json

from app.config import settings
from app.infrastructure.repositories import RatingEventRepository, SessionRepository, UserRepository
from app.scripts.seed import SEED_ADMIN, SEED_APPLICANTS, seed


def _install_fake_gemini(monkeypatch):
    from app.use_cases import propose_rating_events_use_case as module

    class FakeResponse:
        def __init__(self, text):
            self.text = text

    class FakeModels:
        def generate_content(self, **kwargs):
            transcript_text = kwargs["contents"][1]
            first_user_line = next(
                (line[len("[USER] ") :] for line in transcript_text.splitlines() if line.startswith("[USER]")),
                None,
            )
            proposals = (
                [{"indicator": "leadership", "quote": first_user_line, "band": "strong"}]
                if first_user_line
                else []
            )
            return FakeResponse(json.dumps({"proposals": proposals}))

    class FakeClient:
        def __init__(self, **kwargs):
            self.models = FakeModels()

    monkeypatch.setattr(module.genai, "Client", FakeClient)


async def test_seed_creates_admin_applicants_sessions_and_proposed_rating_events(db_session, monkeypatch):
    _install_fake_gemini(monkeypatch)

    user_repo = UserRepository(db_session)
    session_repo = SessionRepository(db_session)
    rating_event_repo = RatingEventRepository(db_session)

    summary = await seed(user_repo, session_repo, rating_event_repo)

    assert summary["created_users"] == len(SEED_APPLICANTS) + 1
    assert summary["created_sessions"] == len(SEED_APPLICANTS)
    assert summary["proposed_events"] == len(SEED_APPLICANTS)

    admin = await user_repo.get_by_email(SEED_ADMIN["email"])
    assert admin is not None
    assert admin.role == "admin"

    summary_again = await seed(user_repo, session_repo, rating_event_repo)
    assert summary_again == {
        "admin_email": SEED_ADMIN["email"],
        "created_users": 0,
        "created_sessions": 0,
        "proposed_events": 0,
    }


async def test_seed_committee_grid_returns_non_empty_rows_immediately_after_seeding(
    client, db_session, monkeypatch
):
    _install_fake_gemini(monkeypatch)

    await seed(UserRepository(db_session), SessionRepository(db_session), RatingEventRepository(db_session))

    monkeypatch.setattr(settings, "admin_creation_secret", "test-admin-secret")
    await client.post(
        "/api/admin/create-admin",
        json={"email": "grid-admin@example.com", "password": "admin-password", "secret": "test-admin-secret"},
    )
    login_res = await client.post(
        "/api/login", json={"email": "grid-admin@example.com", "password": "admin-password"}
    )
    admin_token = login_res.json()["accessToken"]

    res = await client.get("/api/admin/committee", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) >= len(SEED_APPLICANTS)
    assert any(row["indicators"]["leadership"] is not None for row in items)
