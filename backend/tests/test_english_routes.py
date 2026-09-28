import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from app.api.english_routes import router as english_router
from app.infrastructure.database import get_session
from app.main import app
from app.scripts.seed_english import seed_items


@pytest.fixture
async def english_client():
    test_engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    async with AsyncSession(test_engine) as session:
        await seed_items(session)

    async def _override_get_session():
        async with AsyncSession(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = _override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.pop(get_session, None)
    await test_engine.dispose()


@pytest.mark.asyncio
async def test_english_health(english_client):
    res = await english_client.get("/api/english/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True, "service": "english-gate"}


@pytest.mark.asyncio
async def test_demo_start_and_me_flow(english_client):
    # 1. Start demo
    start_res = await english_client.post("/api/english/demo-start")
    assert start_res.status_code == 200
    data = start_res.json()
    assert "token" in data
    assert "id" in data
    token = data["token"]

    # 2. Get /me
    me_res = await english_client.get(
        "/api/english/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["id"] == data["id"]
    assert me_data["state"] == "needs_test"

    # 3. Create test session
    sess_res = await english_client.post(
        "/api/english/sessions", headers={"Authorization": f"Bearer {token}"}
    )
    assert sess_res.status_code == 200
    sess_data = sess_res.json()
    assert "session_id" in sess_data

    # 4. Get current session
    curr_res = await english_client.get(
        "/api/english/sessions/current", headers={"Authorization": f"Bearer {token}"}
    )
    assert curr_res.status_code == 200
    assert curr_res.json()["session_id"] == sess_data["session_id"]

    # 5. Checkin gates
    checkin_res = await english_client.post(
        f"/api/english/sessions/{sess_data['session_id']}/checkin",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "gates": {
                "browser_ok": True,
                "camera_mic_ok": True,
                "screen_share_monitor": True,
                "not_extended": True,
                "fullscreen": True,
                "single_face_confirmed": True,
            },
            "consent": True,
        },
    )
    assert checkin_res.status_code == 200
    assert checkin_res.json()["passed"] is True
    assert "items" in checkin_res.json()


@pytest.mark.asyncio
async def test_ielts_verification_flow(english_client):
    start_res = await english_client.post("/api/english/demo-start")
    token = start_res.json()["token"]

    # Valid TRF from ielts_fixtures.json
    ielts_res = await english_client.post(
        "/api/english/ielts",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "trf_number": "12345678901234A",
            "family_name": "Nazarova",
            "date_of_birth": "2005-03-14",
            "test_date": "2026-01-10",
            "module": "academic",
            "listening": 7.0,
            "reading": 6.5,
            "writing": 6.0,
            "speaking": 7.0,
            "overall": 6.5,
        },
    )
    assert ielts_res.status_code == 200
    data = ielts_res.json()
    assert data["verdict"] == "VERIFIED"
    assert data["overall"] == 6.5
