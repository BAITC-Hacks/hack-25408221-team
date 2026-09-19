from app.config import settings
from app.infrastructure.repositories import SessionRepository


async def _register(client, email):
    res = await client.post(
        "/api/register",
        json={
            "name": "Test User",
            "email": email,
            "password": "correct-horse-battery-staple",
        },
    )
    assert res.status_code == 200
    body = res.json()
    return body["userId"], body["accessToken"]


async def test_create_session_returns_configured_max_duration(client):
    """B12: the timer UI derives its warning thresholds from the server's
    configured interview length instead of a hardcoded guess, so the
    session-creation response must carry it."""
    register_res = await client.post(
        "/api/register",
        json={
            "name": "Grace Hopper",
            "email": "grace@example.com",
            "password": "correct-horse-battery-staple",
        },
    )
    assert register_res.status_code == 200
    user_id = register_res.json()["userId"]
    token = register_res.json()["accessToken"]

    session_res = await client.post(
        "/api/sessions",
        json={"userId": user_id, "program": "General"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert session_res.status_code == 200
    body = session_res.json()
    assert "sessionId" in body
    assert body["maxDurationSecs"] == settings.max_interview_duration


async def test_create_session_requires_user_id(client):
    """A5 regression: this 400 branch used to live inline in the route and
    is now inside StartSessionUseCase -- confirm the relocation preserved it."""
    user_id, token = await _register(client, "no-user-id@example.com")
    res = await client.post(
        "/api/sessions",
        json={"program": "General"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400


async def test_create_session_requires_program(client):
    user_id, token = await _register(client, "no-program@example.com")
    res = await client.post(
        "/api/sessions",
        json={"userId": user_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400


async def test_create_session_rejects_unknown_user(client):
    _, token = await _register(client, "caller@example.com")
    res = await client.post(
        "/api/sessions",
        json={"userId": "does-not-exist", "program": "General"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404


async def test_create_session_rejects_duplicate_after_completion(client, db_session):
    """A5 regression: StartSessionUseCase's 409 branch (one submission per
    user) used to be inline SessionRepository access in the route."""
    user_id, token = await _register(client, "repeat@example.com")

    first = await client.post(
        "/api/sessions",
        json={"userId": user_id, "program": "General"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert first.status_code == 200
    session_id = first.json()["sessionId"]

    await SessionRepository(db_session).complete(session_id)

    second = await client.post(
        "/api/sessions",
        json={"userId": user_id, "program": "General"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert second.status_code == 409


async def test_submit_application_merges_into_existing_session(client, db_session):
    """A5 regression: SubmitApplicationUseCase's existing-session branch
    merges into applicant_data instead of creating a second session."""
    user_id, token = await _register(client, "applicant@example.com")

    create_res = await client.post(
        "/api/sessions",
        json={"userId": user_id, "program": "General"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 200
    session_id = create_res.json()["sessionId"]

    apply_res = await client.post(
        "/api/applications",
        json={
            "userId": user_id,
            "program": "General",
            "formData": {"essay": "Why I want to attend"},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert apply_res.status_code == 200
    assert apply_res.json()["sessionId"] == session_id

    merged = await SessionRepository(db_session).get_by_id(session_id)
    assert merged.applicant_data["form_data"]["essay"] == "Why I want to attend"


async def test_submit_application_requires_user_id(client):
    _, token = await _register(client, "no-app-user-id@example.com")
    res = await client.post(
        "/api/applications",
        json={"program": "General", "formData": {}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400
