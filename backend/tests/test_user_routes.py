from app.config import settings


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


async def _admin_token(client, monkeypatch, email):
    monkeypatch.setattr(settings, "admin_creation_secret", "test-admin-secret")
    create_res = await client.post(
        "/api/admin/create-admin",
        json={
            "email": email,
            "password": "admin-password",
            "secret": "test-admin-secret",
        },
    )
    assert create_res.status_code == 200
    login_res = await client.post(
        "/api/login", json={"email": email, "password": "admin-password"}
    )
    assert login_res.status_code == 200
    return login_res.json()["accessToken"]


async def test_list_users_rejects_non_admin(client):
    """Section 0 checklist item 4: GET /api/users only required a valid
    login, no role check, so any authenticated applicant could list every
    other applicant's name/email/phone/session/evaluation."""
    _, token = await _register(client, "not-admin@example.com")
    res = await client.get("/api/users", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


async def test_list_users_allows_admin(client, monkeypatch):
    await _register(client, "someone@example.com")
    admin_token = await _admin_token(client, monkeypatch, "admin@example.com")

    res = await client.get(
        "/api/users", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)


async def test_get_user_rejects_other_user(client):
    """Section 0 checklist item 4: GET /api/users/{user_id} had no
    ownership/role check, so any authenticated user could fetch any other
    user's full profile by id."""
    _, token = await _register(client, "caller@example.com")
    other_id, _ = await _register(client, "target@example.com")

    res = await client.get(
        f"/api/users/{other_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 403


async def test_get_user_allows_self(client):
    user_id, token = await _register(client, "self@example.com")

    res = await client.get(
        f"/api/users/{user_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    assert res.json()["id"] == user_id


async def test_get_user_allows_admin(client, monkeypatch):
    other_id, _ = await _register(client, "target2@example.com")
    admin_token = await _admin_token(client, monkeypatch, "admin2@example.com")

    res = await client.get(
        f"/api/users/{other_id}", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    assert res.json()["id"] == other_id
