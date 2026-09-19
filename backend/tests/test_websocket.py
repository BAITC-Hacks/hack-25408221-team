"""Integration test for the /ws/{session_id} route added in the app/interview split.

Runs entirely through fastapi.testclient.TestClient so every step (register,
create session, open the websocket, read back the saved session) executes on
the same event loop/thread. Mixing this with the async `client`/`test_engine`
fixtures from conftest.py would bind the aiosqlite connection to two different
event loops and blow up, so this test builds its own engine and never touches
those fixtures.
"""

import json
import logging
import queue
import time

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from fastapi.testclient import TestClient

import app.api.websocket as websocket_route
import app.interview.handler as handler
from app.api.user_routes import limiter as login_limiter
from app.config import settings
from app.infrastructure.database import get_session
from app.infrastructure.repositories import SessionRepository
from app.main import app
from tests.fakes.gemini import (
    FakeLiveSession,
    FakeLiveResponse,
    FakeModelTurn,
    FakePart,
    FakeServerContent,
    end_session_call,
    make_fake_genai_client,
    user_transcript,
)


@pytest.fixture(autouse=True)
def _reset_login_rate_limit():
    """The /api/login limiter (app/api/user_routes.py) is a module-level
    Limiter whose counters persist for the whole pytest process, keyed by a
    remote address that's identical for every TestClient call ("testclient").
    Without a reset, tests that each perform a real login (this file does,
    repeatedly, to mint admin tokens) collectively exhaust the "5/minute"
    quota partway through the suite depending on run order/count -- a
    pre-existing test-isolation gap, not a change to the production limit."""
    login_limiter.reset()
    yield


def _register_and_create_session(client, email):
    register_res = client.post(
        "/api/register",
        json={
            "name": "Applicant",
            "email": email,
            "password": "correct-horse-battery-staple",
        },
    )
    user_id = register_res.json()["userId"]
    token = register_res.json()["accessToken"]

    create_res = client.post(
        "/api/sessions",
        json={"userId": user_id, "program": "Computer Science"},
        headers={"Authorization": f"Bearer {token}"},
    )
    session_id = create_res.json()["sessionId"]
    return session_id, token


def _admin_token(client, secret, email):
    client.post(
        "/api/admin/create-admin",
        json={"email": email, "password": "admin-password", "secret": secret},
    )
    admin_login = client.post(
        "/api/login", json={"email": email, "password": "admin-password"}
    )
    return admin_login.json()["accessToken"]


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
    monkeypatch.setattr(websocket_route, "get_session", provide_session)
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


def test_websocket_rejects_connection_to_another_users_session(monkeypatch):
    """B2 regression: before this fix, any authenticated user could open the
    live connection for *any* session_id, including one owned by someone
    else, and the interview would overwrite that stranger's session."""
    provide_session = _make_session_provider()
    app.dependency_overrides[get_session] = provide_session
    monkeypatch.setattr(handler, "get_session", provide_session)
    monkeypatch.setattr(websocket_route, "get_session", provide_session)

    try:
        with TestClient(app) as client:
            owner_res = client.post(
                "/api/register",
                json={
                    "name": "Owner",
                    "email": "owner@example.com",
                    "password": "correct-horse-battery-staple",
                },
            )
            owner_id = owner_res.json()["userId"]
            owner_token = owner_res.json()["accessToken"]

            create_res = client.post(
                "/api/sessions",
                json={"userId": owner_id, "program": "Computer Science"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            session_id = create_res.json()["sessionId"]

            intruder_res = client.post(
                "/api/register",
                json={
                    "name": "Intruder",
                    "email": "intruder@example.com",
                    "password": "correct-horse-battery-staple",
                },
            )
            intruder_token = intruder_res.json()["accessToken"]

            with client.websocket_connect(
                f"/ws/{session_id}?token={intruder_token}"
            ) as ws:
                error_msg = ws.receive_json()
                assert error_msg["type"] == "error"
                assert "access" in error_msg["message"].lower()
                with pytest.raises(Exception):
                    ws.receive_json()
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_websocket_rejects_connection_to_completed_session(monkeypatch):
    """B2 regression: a completed session must not accept a new live
    connection -- previously nothing stopped a second interview run from
    overwriting an already-submitted evaluation.

    Completes the session by driving one real interview through the
    websocket first (same TestClient/event loop as everything else in this
    file), then attempts a second connection to that now-completed session.
    """
    provide_session = _make_session_provider()
    app.dependency_overrides[get_session] = provide_session
    monkeypatch.setattr(handler, "get_session", provide_session)
    monkeypatch.setattr(websocket_route, "get_session", provide_session)

    fake_session = FakeLiveSession(
        responses=[end_session_call({"applicant_notes": {}, "overall_impression": "x", "recommendation": "recommended"})]
    )
    monkeypatch.setattr(
        handler, "get_genai_client", lambda: make_fake_genai_client(fake_session)
    )

    try:
        with TestClient(app) as client:
            register_res = client.post(
                "/api/register",
                json={
                    "name": "Applicant",
                    "email": "applicant2@example.com",
                    "password": "correct-horse-battery-staple",
                },
            )
            user_id = register_res.json()["userId"]
            token = register_res.json()["accessToken"]

            create_res = client.post(
                "/api/sessions",
                json={"userId": user_id, "program": "Computer Science"},
                headers={"Authorization": f"Bearer {token}"},
            )
            session_id = create_res.json()["sessionId"]

            with client.websocket_connect(f"/ws/{session_id}?token={token}") as ws:
                ws.receive_json()
                ws.receive_json()

            with client.websocket_connect(f"/ws/{session_id}?token={token}") as ws:
                error_msg = ws.receive_json()
                assert error_msg["type"] == "error"
                assert "completed" in error_msg["message"].lower()
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_websocket_coalesces_streamed_transcription_fragments_into_one_turn(monkeypatch):
    """B4 regression: Gemini streams input/output transcription as multiple
    fragments of the same turn, not one message per turn. Before this fix,
    every fragment became its own transcript entry, so one sentence spoken by
    the user showed up as several disjoint "user" rows instead of one."""
    provide_session = _make_session_provider()
    app.dependency_overrides[get_session] = provide_session
    monkeypatch.setattr(handler, "get_session", provide_session)
    monkeypatch.setattr(websocket_route, "get_session", provide_session)
    monkeypatch.setattr(settings, "admin_creation_secret", "test-admin-secret")

    fake_session = FakeLiveSession(
        responses=[
            user_transcript("Hello, "),
            user_transcript("I'm excited "),
            user_transcript("about robotics."),
            end_session_call({"applicant_notes": {}, "overall_impression": "x", "recommendation": "recommended"}),
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
                    "name": "Applicant",
                    "email": "fragments@example.com",
                    "password": "correct-horse-battery-staple",
                },
            )
            user_id = register_res.json()["userId"]
            token = register_res.json()["accessToken"]

            create_res = client.post(
                "/api/sessions",
                json={"userId": user_id, "program": "Computer Science"},
                headers={"Authorization": f"Bearer {token}"},
            )
            session_id = create_res.json()["sessionId"]

            admin_res = client.post(
                "/api/admin/create-admin",
                json={
                    "email": "fragments-admin@example.com",
                    "password": "admin-password",
                    "secret": "test-admin-secret",
                },
            )
            assert admin_res.status_code == 200

            admin_login = client.post(
                "/api/login",
                json={"email": "fragments-admin@example.com", "password": "admin-password"},
            )
            admin_token = admin_login.json()["accessToken"]

            with client.websocket_connect(f"/ws/{session_id}?token={token}") as ws:
                ws.receive_json()
                ws.receive_json()

            session_res = client.get(
                f"/api/admin/sessions/{session_id}",
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert session_res.status_code == 200
            transcript = session_res.json()["transcript"]

            user_entries = [entry for entry in transcript if entry["role"] == "user"]
            assert len(user_entries) == 1
            assert user_entries[0]["text"] == "Hello, I'm excited about robotics."
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_websocket_rejects_second_concurrent_connection_to_same_session(monkeypatch):
    """B3 regression: before this fix, nothing stopped two concurrent websocket
    connections (e.g. a duplicate tab, or a reconnect while the old socket was
    still open) from both driving the same Gemini Live session/transcript for
    one session_id at once."""
    provide_session = _make_session_provider()
    app.dependency_overrides[get_session] = provide_session
    monkeypatch.setattr(handler, "get_session", provide_session)
    monkeypatch.setattr(websocket_route, "get_session", provide_session)

    fake_session = FakeLiveSession(responses=[], hang_when_exhausted=True)
    monkeypatch.setattr(
        handler, "get_genai_client", lambda: make_fake_genai_client(fake_session)
    )

    try:
        with TestClient(app) as client:
            register_res = client.post(
                "/api/register",
                json={
                    "name": "Applicant",
                    "email": "duplicate@example.com",
                    "password": "correct-horse-battery-staple",
                },
            )
            user_id = register_res.json()["userId"]
            token = register_res.json()["accessToken"]

            create_res = client.post(
                "/api/sessions",
                json={"userId": user_id, "program": "Computer Science"},
                headers={"Authorization": f"Bearer {token}"},
            )
            session_id = create_res.json()["sessionId"]

            with client.websocket_connect(f"/ws/{session_id}?token={token}") as ws1:
                status_msg = ws1.receive_json()
                assert status_msg["type"] == "status"

                with client.websocket_connect(f"/ws/{session_id}?token={token}") as ws2:
                    error_msg = ws2.receive_json()
                    assert error_msg["type"] == "error"
                    assert "active connection" in error_msg["message"].lower()
    finally:
        app.dependency_overrides.pop(get_session, None)


def _poll_session_status(client, session_id, admin_token, attempts=40, interval=0.05):
    """Starlette's TestClient forcibly cancels the server-side task shortly
    after the `with websocket_connect(...)` block exits, with no guarantee
    the app's own disconnect-triggered cleanup has finished first. Polling
    the session (from inside the `with` block, before it exits) lets that
    cleanup actually complete instead of getting cancelled mid-write."""
    body = None
    for _ in range(attempts):
        session_res = client.get(
            f"/api/admin/sessions/{session_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert session_res.status_code == 200
        body = session_res.json()
        if body["status"] != "in_progress":
            return body
        time.sleep(interval)
    return body


def test_websocket_disconnect_before_any_speech_marks_session_incomplete(monkeypatch):
    """B6 regression: before this fix, a disconnect before the applicant said
    anything (empty transcript) left the session silently `in_progress`
    forever -- no status, no signal an interview was even attempted."""
    provide_session = _make_session_provider()
    app.dependency_overrides[get_session] = provide_session
    monkeypatch.setattr(handler, "get_session", provide_session)
    monkeypatch.setattr(websocket_route, "get_session", provide_session)
    monkeypatch.setattr(settings, "admin_creation_secret", "test-admin-secret")

    fake_session = FakeLiveSession(responses=[], hang_when_exhausted=True)
    monkeypatch.setattr(
        handler, "get_genai_client", lambda: make_fake_genai_client(fake_session)
    )

    try:
        with TestClient(app) as client:
            session_id, token = _register_and_create_session(
                client, "no-speech@example.com"
            )
            admin_token = _admin_token(
                client, "test-admin-secret", "no-speech-admin@example.com"
            )

            with client.websocket_connect(f"/ws/{session_id}?token={token}") as ws:
                status_msg = ws.receive_json()
                assert status_msg["type"] == "status"

                ws.close(1000)
                body = _poll_session_status(client, session_id, admin_token)

            assert body["status"] == "incomplete"
            assert body["completed_at"] is None
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_websocket_disconnect_mid_interview_marks_session_incomplete_with_partial_transcript(
    monkeypatch,
):
    """B6 regression: a disconnect after some speech but before `end_session`
    was called must still persist whatever transcript exists, tagged
    `status: incomplete` -- not silently dropped and not reported as a
    successful completion."""
    provide_session = _make_session_provider()
    app.dependency_overrides[get_session] = provide_session
    monkeypatch.setattr(handler, "get_session", provide_session)
    monkeypatch.setattr(websocket_route, "get_session", provide_session)
    monkeypatch.setattr(settings, "admin_creation_secret", "test-admin-secret")

    fake_session = FakeLiveSession(
        responses=[user_transcript("Hello, I have to go.")],
        hang_when_exhausted=True,
    )
    monkeypatch.setattr(
        handler, "get_genai_client", lambda: make_fake_genai_client(fake_session)
    )

    try:
        with TestClient(app) as client:
            session_id, token = _register_and_create_session(
                client, "mid-interview@example.com"
            )
            admin_token = _admin_token(
                client, "test-admin-secret", "mid-interview-admin@example.com"
            )

            with client.websocket_connect(f"/ws/{session_id}?token={token}") as ws:
                status_msg = ws.receive_json()
                assert status_msg["type"] == "status"

                ws.close(1000)
                body = _poll_session_status(client, session_id, admin_token)

            assert body["status"] == "incomplete"
            assert body["completed_at"] is None
            user_entries = [e for e in body["transcript"] if e["role"] == "user"]
            assert len(user_entries) == 1
            assert user_entries[0]["text"] == "Hello, I have to go."
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_websocket_end_session_with_invalid_recommendation_never_reports_success(monkeypatch):
    """B7 regression: before this fix, end_session always told the client and
    Gemini "success" even when the tool-call args didn't match the schema
    already declared in build_end_session_tool() (e.g. an out-of-enum
    `recommendation`), and save_evaluation() silently swallowed the resulting
    exception -- so a malformed args payload looked identical to a real save
    but persisted nothing usable."""
    provide_session = _make_session_provider()
    app.dependency_overrides[get_session] = provide_session
    monkeypatch.setattr(handler, "get_session", provide_session)
    monkeypatch.setattr(websocket_route, "get_session", provide_session)
    monkeypatch.setattr(settings, "admin_creation_secret", "test-admin-secret")

    fake_session = FakeLiveSession(
        responses=[
            end_session_call(
                {
                    "applicant_notes": {},
                    "overall_impression": "Looked promising",
                    "recommendation": "definitely_hire",  # not a valid enum value
                }
            )
        ]
    )
    monkeypatch.setattr(
        handler, "get_genai_client", lambda: make_fake_genai_client(fake_session)
    )

    try:
        with TestClient(app) as client:
            session_id, token = _register_and_create_session(
                client, "bad-args@example.com"
            )
            admin_token = _admin_token(
                client, "test-admin-secret", "bad-args-admin@example.com"
            )

            with client.websocket_connect(f"/ws/{session_id}?token={token}") as ws:
                status_msg = ws.receive_json()
                assert status_msg["type"] == "status"

                ended_msg = ws.receive_json()
                assert ended_msg["type"] == "interview_ended"
                assert "unable to save" in ended_msg["message"].lower()

                body = _poll_session_status(client, session_id, admin_token)

            assert body["status"] == "incomplete"
            assert body["completed_at"] is None
            assert body["evaluation"]["evaluation_save_failed"] is True
            assert "invalid args" in body["evaluation"]["reason"].lower()
            assert fake_session.tool_responses[0][0].response["status"] == "error"
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_websocket_end_session_dead_letters_after_persistent_db_failure(monkeypatch):
    """B7 regression: a DB failure during the evaluation write must not be
    reported to the client/Gemini as success, and must not be silently
    dropped -- it should retry, then dead-letter the raw args so nothing is
    lost, and mark the session incomplete."""
    provide_session = _make_session_provider()
    app.dependency_overrides[get_session] = provide_session
    monkeypatch.setattr(handler, "get_session", provide_session)
    monkeypatch.setattr(websocket_route, "get_session", provide_session)
    monkeypatch.setattr(settings, "admin_creation_secret", "test-admin-secret")
    monkeypatch.setattr(settings, "evaluation_save_max_attempts", 2)
    monkeypatch.setattr(settings, "evaluation_save_retry_delay_seconds", 0.01)

    async def always_fail_complete(self, session_id):
        raise RuntimeError("simulated DB outage")

    monkeypatch.setattr(SessionRepository, "complete", always_fail_complete)

    fake_session = FakeLiveSession(
        responses=[
            end_session_call(
                {
                    "applicant_notes": {"q1_why_applying": "Because I love robotics"},
                    "overall_impression": "Strong candidate",
                    "recommendation": "recommended",
                }
            )
        ]
    )
    monkeypatch.setattr(
        handler, "get_genai_client", lambda: make_fake_genai_client(fake_session)
    )

    try:
        with TestClient(app) as client:
            session_id, token = _register_and_create_session(
                client, "db-outage@example.com"
            )
            admin_token = _admin_token(
                client, "test-admin-secret", "db-outage-admin@example.com"
            )

            with client.websocket_connect(f"/ws/{session_id}?token={token}") as ws:
                status_msg = ws.receive_json()
                assert status_msg["type"] == "status"

                ended_msg = ws.receive_json()
                assert ended_msg["type"] == "interview_ended"
                assert "unable to save" in ended_msg["message"].lower()

                body = _poll_session_status(client, session_id, admin_token)

            assert body["status"] == "incomplete"
            assert body["completed_at"] is None
            assert body["evaluation"]["evaluation_save_failed"] is True
            assert "db write failed after 2 attempts" in body["evaluation"]["reason"].lower()
            assert fake_session.tool_responses[0][0].response["status"] == "error"
    finally:
        app.dependency_overrides.pop(get_session, None)


def _receive_json_no_hang(ws, timeout):
    """Starlette's WebSocketTestSession.receive_json() blocks on a plain
    queue.Queue.get() with no timeout -- if a message never arrives (exactly
    the failure mode these two regression tests exist to catch), that call
    hangs forever instead of failing. Reach into the same queue the real
    receive() reads from, but with a bounded wait."""
    message = ws._send_queue.get(timeout=timeout)
    if isinstance(message, BaseException):
        raise message
    return json.loads(message["text"])


def _send_audio_until(ws, predicate, overall_timeout, poll_interval=0.02):
    """Simulates the frontend's continuous, VAD-less mic stream (see
    frontend/public/pcm-processor.js -- it fires on every audio-render
    quantum with no amplitude gating) by sending raw bytes in a tight loop,
    while polling for a message matching `predicate` in between sends.
    Returns the first matching message, or None if `overall_timeout` elapses
    first."""
    deadline = time.time() + overall_timeout
    while time.time() < deadline:
        ws.send_bytes(b"\x00\x00\x00\x00")
        try:
            message = ws._send_queue.get(timeout=poll_interval)
        except queue.Empty:
            continue
        if isinstance(message, BaseException):
            raise message
        payload = json.loads(message["text"])
        if predicate(payload):
            return payload
    return None


def test_silence_monitor_fires_despite_continuous_audio_with_no_real_speech(monkeypatch):
    """B1 regression: before this fix, forward_to_gemini() reset the silence
    timer on every raw audio chunk received from the client, with no regard
    for whether it contained speech. Since the frontend streams PCM
    continuously (no VAD gating) for as long as the mic is open, the timer
    was effectively always "now" and the check-in could never fire -- the
    monitor was structurally dead. This test sends continuous audio, exactly
    like the real frontend does, with no scripted user speech ever
    transcribed, and asserts a check-in still arrives."""
    provide_session = _make_session_provider()
    app.dependency_overrides[get_session] = provide_session
    monkeypatch.setattr(handler, "get_session", provide_session)
    monkeypatch.setattr(websocket_route, "get_session", provide_session)
    monkeypatch.setattr(handler, "CHECK_IN_INTERVAL", 0.1)
    monkeypatch.setattr(handler, "CHECK_IN_WAIT", 0.1)
    monkeypatch.setattr(handler, "MAX_CHECK_INS", 1)

    fake_session = FakeLiveSession(responses=[], hang_when_exhausted=True)
    monkeypatch.setattr(
        handler, "get_genai_client", lambda: make_fake_genai_client(fake_session)
    )

    try:
        with TestClient(app) as client:
            session_id, token = _register_and_create_session(
                client, "continuous-audio@example.com"
            )

            with client.websocket_connect(f"/ws/{session_id}?token={token}") as ws:
                status_msg = _receive_json_no_hang(ws, timeout=2)
                assert status_msg["type"] == "status"

                check_in_msg = _send_audio_until(
                    ws, lambda m: m["type"] == "check_in", overall_timeout=3
                )
                assert check_in_msg is not None, (
                    "no check_in arrived despite continuous silence -- the "
                    "monitor is still being fooled by raw audio bytes"
                )

                ws.close(1000)
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_silence_monitor_suppresses_check_in_while_agent_is_speaking(monkeypatch):
    """B1 regression: before this fix, there was no notion of "the agent is
    currently talking" anywhere -- the monitor would happily check in on the
    user for staying silent while the agent's own turn was still playing out,
    which is expected silence, not inactivity. Scripts a model_turn with no
    matching turn_complete (so agent_speaking stays True indefinitely) and
    asserts no check-in ever arrives, no matter how long the user is quiet."""
    provide_session = _make_session_provider()
    app.dependency_overrides[get_session] = provide_session
    monkeypatch.setattr(handler, "get_session", provide_session)
    monkeypatch.setattr(websocket_route, "get_session", provide_session)
    monkeypatch.setattr(handler, "CHECK_IN_INTERVAL", 0.05)
    monkeypatch.setattr(handler, "CHECK_IN_WAIT", 0.05)
    monkeypatch.setattr(handler, "MAX_CHECK_INS", 1)

    fake_session = FakeLiveSession(
        responses=[
            FakeLiveResponse(
                server_content=FakeServerContent(
                    model_turn=FakeModelTurn(
                        parts=[FakePart(text="Tell me about yourself...")]
                    )
                )
            )
        ],
        hang_when_exhausted=True,
    )
    monkeypatch.setattr(
        handler, "get_genai_client", lambda: make_fake_genai_client(fake_session)
    )

    try:
        with TestClient(app) as client:
            session_id, token = _register_and_create_session(
                client, "agent-speaking@example.com"
            )

            with client.websocket_connect(f"/ws/{session_id}?token={token}") as ws:
                status_msg = _receive_json_no_hang(ws, timeout=2)
                assert status_msg["type"] == "status"

                with pytest.raises(queue.Empty):
                    _receive_json_no_hang(ws, timeout=0.4)

                ws.close(1000)
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_admin_creation_log_omits_email(monkeypatch, caplog):
    """B15 regression: app/api/admin_routes.py used to log the admin's raw
    email at INFO on account creation. Assert the email never appears in a
    log record, while the creation event itself is still observable."""
    provide_session = _make_session_provider()
    app.dependency_overrides[get_session] = provide_session
    monkeypatch.setattr(settings, "admin_creation_secret", "test-admin-secret")

    try:
        with TestClient(app) as client:
            with caplog.at_level(logging.INFO):
                _admin_token(client, "test-admin-secret", "secret-admin@example.com")

            messages = [r.getMessage() for r in caplog.records]
            assert not any("secret-admin@example.com" in m for m in messages)
            assert any("Admin account created" in m for m in messages)
    finally:
        app.dependency_overrides.pop(get_session, None)


def test_interview_logs_omit_transcript_content_at_info_and_include_session_id(
    monkeypatch, caplog
):
    """B15 regression: forward_from_gemini() used to log the applicant's
    transcribed speech verbatim at INFO -- sensitive interview content, not
    metadata. It should still be loggable for local debugging (DEBUG), but
    must not land in default (INFO) production logs. Separately, several
    lifecycle log lines in this module didn't carry the session_id at all,
    making them useless for correlating with a specific interview."""
    provide_session = _make_session_provider()
    app.dependency_overrides[get_session] = provide_session
    monkeypatch.setattr(handler, "get_session", provide_session)
    monkeypatch.setattr(websocket_route, "get_session", provide_session)

    sensitive_text = "My home address is 42 Wallaby Way, Sydney."
    fake_session = FakeLiveSession(
        responses=[user_transcript(sensitive_text)],
        hang_when_exhausted=True,
    )
    monkeypatch.setattr(
        handler, "get_genai_client", lambda: make_fake_genai_client(fake_session)
    )

    try:
        with TestClient(app) as client:
            session_id, token = _register_and_create_session(
                client, "log-hygiene@example.com"
            )

            with caplog.at_level(logging.INFO):
                with client.websocket_connect(f"/ws/{session_id}?token={token}") as ws:
                    status_msg = ws.receive_json()
                    assert status_msg["type"] == "status"
                    time.sleep(0.2)
                    ws.close(1000)

            info_messages = [
                r.getMessage() for r in caplog.records if r.levelno == logging.INFO
            ]
            assert not any(sensitive_text in m for m in info_messages)
            assert any(session_id in m for m in info_messages)
    finally:
        app.dependency_overrides.pop(get_session, None)
