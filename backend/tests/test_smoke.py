from tests.fakes.gemini import (
    FakeLiveSession,
    end_session_call,
    make_fake_genai_client,
    user_transcript,
)


async def test_register_login_and_fetch_user(client):
    register_res = await client.post(
        "/api/register",
        json={
            "name": "Ada Lovelace",
            "email": "ada@example.com",
            "password": "correct-horse-battery-staple",
        },
    )
    assert register_res.status_code == 200
    register_body = register_res.json()
    assert register_body["name"] == "Ada Lovelace"
    user_id = register_body["userId"]
    token = register_body["accessToken"]

    login_res = await client.post(
        "/api/login",
        json={"email": "ada@example.com", "password": "correct-horse-battery-staple"},
    )
    assert login_res.status_code == 200
    assert login_res.json()["userId"] == user_id

    me_res = await client.get(
        f"/api/users/{user_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "ada@example.com"


async def test_register_rejects_duplicate_email(client):
    payload = {
        "name": "Grace Hopper",
        "email": "grace@example.com",
        "password": "another-strong-password",
    }
    first = await client.post("/api/register", json=payload)
    assert first.status_code == 200

    second = await client.post("/api/register", json=payload)
    assert second.status_code == 400


async def test_fake_gemini_session_scripts_a_conversation():
    session = FakeLiveSession(
        responses=[
            user_transcript("Hello there"),
            end_session_call(
                {
                    "applicant_notes": {"q1_why_applying": "Because I love it"},
                    "overall_impression": "Solid candidate",
                    "recommendation": "recommended",
                }
            ),
        ]
    )
    fake_client = make_fake_genai_client(session)

    responses = []
    async with fake_client.aio.live.connect(model="fake-model", config=None) as live_session:
        await live_session.send_realtime_input(audio=type("Blob", (), {"data": b"\x00\x01"})())
        async for response in live_session.receive():
            responses.append(response)

    assert session.sent_audio == [b"\x00\x01"]
    assert responses[0].server_content.input_transcription.text == "Hello there"
    assert responses[1].tool_call.function_calls[0].name == "end_session"
    assert session.closed is True
