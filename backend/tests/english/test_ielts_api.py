import pytest


async def _create_applicant(client, platform_headers, external_id="app-1"):
    resp = await client.post(
        "/applicants",
        json={"external_id": external_id, "full_name": "Test Applicant", "email": "a@b.com"},
        headers=platform_headers,
    )
    assert resp.status_code == 200
    return resp.json()


async def test_verified_ielts_skips_test_and_places(client, platform_headers):
    applicant = await _create_applicant(client, platform_headers)
    headers = {"Authorization": f"Bearer {applicant['token']}"}

    resp = await client.post(
        "/ielts",
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
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["verdict"] == "VERIFIED"

    me = await client.get("/me", headers=headers)
    assert me.json()["state"] == "placed"
    assert me.json()["placement"] == "BACHELOR"


async def test_expired_ielts_needs_test(client, platform_headers):
    applicant = await _create_applicant(client, platform_headers, "app-2")
    headers = {"Authorization": f"Bearer {applicant['token']}"}

    resp = await client.post(
        "/ielts",
        json={
            "trf_number": "EXPIREDTRF000001",
            "family_name": "Serikov",
            "date_of_birth": "2004-07-01",
            "test_date": "2021-05-01",
            "module": "academic",
            "listening": 6.5,
            "reading": 6.0,
            "writing": 5.5,
            "speaking": 6.0,
            "overall": 6.0,
        },
        headers=headers,
    )
    assert resp.json()["verdict"] == "EXPIRED"
    me = await client.get("/me", headers=headers)
    assert me.json()["state"] == "needs_test"


async def test_unknown_trf_not_verified(client, platform_headers):
    applicant = await _create_applicant(client, platform_headers, "app-3")
    headers = {"Authorization": f"Bearer {applicant['token']}"}

    resp = await client.post(
        "/ielts",
        json={
            "trf_number": "UNKNOWNTRF000001",
            "family_name": "Nobody",
            "date_of_birth": "2005-01-01",
            "test_date": "2026-01-01",
            "module": "academic",
            "listening": 6.0,
            "reading": 6.0,
            "writing": 6.0,
            "speaking": 6.0,
            "overall": 6.0,
        },
        headers=headers,
    )
    assert resp.json()["verdict"] == "NOT_VERIFIED"
    assert resp.json()["reason"] == "not_found"


async def test_scores_mismatch_not_verified(client, platform_headers):
    applicant = await _create_applicant(client, platform_headers, "app-4")
    headers = {"Authorization": f"Bearer {applicant['token']}"}

    resp = await client.post(
        "/ielts",
        json={
            "trf_number": "MISMATCHTRF000001",
            "family_name": "Tulegenova",
            "date_of_birth": "2005-11-20",
            "test_date": "2026-02-01",
            "module": "academic",
            "listening": 7.0,  # fixture has 5.0
            "reading": 7.0,
            "writing": 7.0,
            "speaking": 7.0,
            "overall": 7.0,
        },
        headers=headers,
    )
    assert resp.json()["verdict"] == "NOT_VERIFIED"
    assert resp.json()["reason"] == "scores_mismatch"


async def test_bad_arithmetic_returns_422(client, platform_headers):
    applicant = await _create_applicant(client, platform_headers, "app-5")
    headers = {"Authorization": f"Bearer {applicant['token']}"}

    resp = await client.post(
        "/ielts",
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
            "overall": 9.0,
        },
        headers=headers,
    )
    assert resp.status_code == 422


async def test_missing_platform_key_rejected(client):
    resp = await client.post(
        "/applicants", json={"external_id": "x", "full_name": "X", "email": "x@x.com"}
    )
    assert resp.status_code == 401

async def test_forged_test_date_cannot_bypass_expiry(client, platform_headers):
    a=await _create_applicant(client,platform_headers,'forged-date')
    r=await client.post('/ielts',headers={'Authorization':f"Bearer {a['token']}"},json={
        'trf_number':'EXPIREDTRF000001','family_name':'Serikov','date_of_birth':'2004-07-01',
        'test_date':'2026-01-01','module':'academic','listening':6.5,'reading':6.0,'writing':5.5,'speaking':6.0,'overall':6.0})
    assert r.status_code==200
    assert r.json()['verdict']=='EXPIRED'
