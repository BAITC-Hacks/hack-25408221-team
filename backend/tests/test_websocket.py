"""Integration test for the /ws/{session_id} route added in the app/interview split.

Runs entirely through fastapi.testclient.TestClient so every step (register,
create session, open the websocket, read back the saved session) executes on
the same event loop/thread. Mixing this with the async `client`/`test_engine`
fixtures from conftest.py would bind the aiosqlite connection to two different
event loops and blow up, so this test builds its own engine and never touches
those fixtures.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from fastapi.testclient import TestClient

import app.interview.handler as handler
from app.config import settings
from app.infrastructure.database import get_session
from app.main import app
from tests.fakes.gemini import FakeLiveSession, end_session_call, make_fake_genai_client, user_transcript


def _make_session_provider():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    initialized = False

    async def provide_session():
        nonlocal initialized
        if not initialized:
            async with engine.begin() as conn:
                await conn.run_sync(SQLModel.metadata.create_all)
            initialized = True
        async with AsyncSession(engine) as session:
            yield session

    return provide_session


def test_websocket_end_session_persists_transcript_and_evaluation(monkeypatch):
    provide_session = _make_session_provider()
    app.dependency_overrides[get_session] = provide_session
    monkeypatch.setattr(handler, "get_session", provide_session)
    monkeypatch.setattr(settings, "admin_creation_secret", "test-admin-secret")

    fake_session = FakeLiveSession(
        responses=[
            user_transcript("Hello, I'm excited about robotics."),
            end_session_call(
                {
                    "applicant_notes": {"q1_why_applying": "Because I love robotics"},
                    "overall_impression": "Strong candidate",
                    "overall_score": 8,
                    "recommendation": "recommended",
                    "strengths": ["clear communicator"],
                    "concerns": [],
                }
            ),
        ]
    )
    monkeypatch.setattr(
        handler, "get_genai_client", lambda: make_fake_genai_client(fake_session)
    )

    try:
        with TestClient(app) as client:
            register_res = client.post(
                "/api/register",
                json={
                    "name": "Test Applicant",
                    "email": "applicant@example.com",
                    "password": "correct-horse-battery-staple",
                },
            )
            assert register_res.status_code == 200
            user_id = register_res.json()["userId"]
            token = register_res.json()["accessToken"]

            create_res = client.post(
                "/api/sessions",
                json={"userId": user_id, "program": "Computer Science"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert create_res.status_code == 200
            session_id = create_res.json()["sessionId"]

            admin_res = client.post(
                "/api/admin/create-admin",
                json={
                    "email": "admin@example.com",
                    "password": "admin-password",
                    "secret": "test-admin-secret",
                },
            )
            assert admin_res.status_code == 200

            admin_login = client.post(
                "/api/login",
                json={"email": "admin@example.com", "password": "admin-password"},
            )
            assert admin_login.status_code == 200
            admin_token = admin_login.json()["accessToken"]

            with client.websocket_connect(f"/ws/{session_id}?token={token}") as ws:
                status_msg = ws.receive_json()
                assert status_msg["type"] == "status"

                ended_msg = ws.receive_json()
                assert ended_msg["type"] == "interview_ended"

            session_res = client.get(
                f"/api/admin/sessions/{session_id}",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert session_res.status_code == 200
            session_body = session_res.json()

            assert session_body["completed_at"] is not None
            assert session_body["evaluation"]["recommendation"] == "recommended"
            assert session_body["applicant_data"]["q1_why_applying"] == "Because I love robotics"
            assert any(entry["role"] == "user" for entry in session_body["transcript"])
    finally:
        app.dependency_overrides.pop(get_session, None)
