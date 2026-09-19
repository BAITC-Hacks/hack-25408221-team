from app.config import settings
from app.ml.scorer import CoreScorer

SAMPLE_APPLICANT_DATA = {
    "q1_why_applying": "I want to build software that helps people learn.",
    "q2_program_choice": "Computer Science -- strong foundation for building products.",
}
SAMPLE_TRANSCRIPT = [
    {"role": "assistant", "text": "Why are you applying?"},
    {"role": "user", "text": "Because I love building things."},
]
SAMPLE_EVALUATION = {
    "overall_score": 8.0,
    "recommendation": "recommended",
}


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


def test_core_scorer_returns_six_canonical_keys():
    """A6: CoreScorer.score_core replaces the identical inline 6-function
    bundle previously duplicated in admin_routes.py, demo_routes.py, and
    enhanced_analysis.py -- lock its output shape."""
    scores = CoreScorer().score_core(SAMPLE_APPLICANT_DATA, SAMPLE_TRANSCRIPT, SAMPLE_EVALUATION)

    assert set(scores.keys()) == {
        "data_quality",
        "baseline",
        "agreement",
        "inconsistencies",
        "edge_cases",
        "authenticity",
    }
    assert "overall_score" in scores["data_quality"]
    assert "recommendation" in scores["baseline"]
    assert scores["agreement"]["ai_recommendation"] == "recommended"


def test_core_scorer_handles_missing_data():
    scores = CoreScorer().score_core(None, None, None)
    assert set(scores.keys()) == {
        "data_quality",
        "baseline",
        "agreement",
        "inconsistencies",
        "edge_cases",
        "authenticity",
    }


async def test_demo_analyze_uses_core_scorer_output(client):
    """A6 regression: demo_analyze's response shape (nested error_analysis,
    baseline_evaluation key names) must survive routing through CoreScorer."""
    _, token = await _register(client, "demo-user@example.com")

    res = await client.post(
        "/api/demo/analyze",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["used_sample_data"] is True
    assert "overall_score" in body["data_quality"]
    assert "recommendation" in body["baseline_evaluation"]
    assert "inconsistencies" in body["error_analysis"]
    assert "edge_cases" in body["error_analysis"]
    assert "authenticity" in body


async def test_admin_triage_queue_includes_scored_session(client, monkeypatch):
    """A6 regression: admin_triage_queue's per-session item shape must survive
    routing through CoreScorer instead of six inline calls."""
    user_id, token = await _register(client, "triage-applicant@example.com")
    await client.post(
        "/api/sessions",
        json={"userId": user_id, "program": "General"},
        headers={"Authorization": f"Bearer {token}"},
    )

    admin_token = await _admin_token(client, monkeypatch, "triage-admin@example.com")

    res = await client.get(
        "/api/admin/triage",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    body = res.json()

    assert body["total"] == 1
    all_entries = [
        entry for tier_items in body["queue"].values() for entry in tier_items
    ]
    assert len(all_entries) == 1
    entry = all_entries[0]
    assert "triage" in entry
    assert "summary_card" in entry
