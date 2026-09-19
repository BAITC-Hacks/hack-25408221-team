from app.config import settings


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
