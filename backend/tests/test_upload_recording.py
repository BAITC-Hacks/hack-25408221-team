import asyncio

import pytest

from app.infrastructure import s3_client as s3_client_module


@pytest.fixture(autouse=True)
def local_uploads(tmp_path, monkeypatch):
    """upload_file/get_presigned_url read the module-level _LOCAL_DIR global
    directly, so redirecting it here keeps test uploads out of the repo's
    real ./uploads/ directory."""
    monkeypatch.setattr(s3_client_module, "_LOCAL_DIR", tmp_path)


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


async def _create_session(client, user_id, token):
    res = await client.post(
        "/api/sessions",
        json={"userId": user_id, "program": "General"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    return res.json()["sessionId"]


def _upload_call(client, session_id, token, content=b"fake video bytes"):
    return client.post(
        "/api/upload-recording",
        data={"sessionId": session_id},
        files={"file": (f"{session_id}.webm", content, "video/webm")},
        headers={"Authorization": f"Bearer {token}"},
    )


async def test_upload_recording_rejects_non_owner(client):
    """B8 regression: upload_recording never checked current_user against
    the session's owner, so any authenticated user could upload a recording
    to any session_id they could guess."""
    owner_id, owner_token = await _register(client, "owner@example.com")
    session_id = await _create_session(client, owner_id, owner_token)

    _, intruder_token = await _register(client, "intruder@example.com")

    res = await _upload_call(client, session_id, intruder_token)
    assert res.status_code == 403


async def test_upload_recording_rejects_missing_session(client):
    _, token = await _register(client, "noone@example.com")
    res = await _upload_call(client, "does-not-exist", token)
    assert res.status_code == 404


async def test_upload_recording_allows_owner_and_overwrites_on_reupload(client):
    """B8 regression: UploadRecordingUseCase used to hard-block a second
    upload for the same session ("Recording already uploaded"), so a client
    retry after a network blip (or a legitimate re-submit) got a permanent
    error instead of overwriting the deterministic per-session key."""
    owner_id, owner_token = await _register(client, "owner2@example.com")
    session_id = await _create_session(client, owner_id, owner_token)

    first = await _upload_call(client, session_id, owner_token, b"first take")
    assert first.status_code == 200
    assert first.json()["ok"] is True

    second = await _upload_call(
        client, session_id, owner_token, b"second take, longer than the first"
    )
    assert second.status_code == 200
    assert second.json()["ok"] is True


async def test_concurrent_uploads_to_same_session_both_succeed(client):
    owner_id, owner_token = await _register(client, "owner3@example.com")
    session_id = await _create_session(client, owner_id, owner_token)

    results = await asyncio.gather(
        _upload_call(client, session_id, owner_token, b"concurrent A"),
        _upload_call(client, session_id, owner_token, b"concurrent B"),
    )

    for res in results:
        assert res.status_code == 200
        assert res.json()["ok"] is True
