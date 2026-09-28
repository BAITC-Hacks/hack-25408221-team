import os
from pathlib import Path

# Pin settings before EnglishSettings is instantiated
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("STORAGE_LOCAL_PATH", "/tmp/english-gate-test-storage")
os.environ.setdefault("ADMIN_EMAIL", "admin@invision.demo")
os.environ.setdefault("ADMIN_PASSWORD", "admin123")
os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-production-32bytes")
os.environ.setdefault("PLATFORM_API_KEY", "dev-platform-key")
os.environ.setdefault("WEBHOOK_SECRET", "test-webhook-secret")
os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("ASR_BACKEND", "fake")
os.environ.setdefault("LANGUAGETOOL_BACKEND", "fake")
os.environ.setdefault("IELTS_VERIFIER", "mock")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from app.english.config import english_settings
from app.english.core.security import create_admin_token, create_applicant_token
from app.english.deps import (
    get_asr,
    get_db,
    get_languagetool,
    get_llm,
    get_storage_dep,
    get_verifier,
    get_webhook,
)
from app.english.ielts.verifier import MockIeltsVerifier
from app.english.infra.asr import FakeASRClient
from app.english.infra.languagetool import FakeLanguageToolClient
from app.english.infra.llm import FakeLLMClient
from app.english.infra.models import Item
from app.english.infra.storage import LocalStorage
from app.english.infra.webhook import FakeWebhookSender
from app.english.test_engine.item_loading import split_item
from app.infrastructure.database import get_session
from app.main import app


@pytest_asyncio.fixture
async def test_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        yield session


@pytest.fixture
def fake_webhook():
    return FakeWebhookSender()


@pytest.fixture
def fake_llm():
    return FakeLLMClient(script=["{}"])


@pytest.fixture
def fake_asr():
    return FakeASRClient()


@pytest_asyncio.fixture
async def client(test_engine, tmp_path, fake_webhook, fake_llm, fake_asr):
    async def _override_get_session():
        async with AsyncSession(test_engine, expire_on_commit=False) as session:
            yield session

    fixtures_file = (
        Path(__file__).resolve().parent.parent.parent
        / "app"
        / "english"
        / "data"
        / "ielts_fixtures.json"
    )

    app.dependency_overrides[get_session] = _override_get_session
    app.dependency_overrides[get_db] = _override_get_session
    app.dependency_overrides[get_verifier] = lambda: MockIeltsVerifier(
        fixtures_path=str(fixtures_file)
    )
    app.dependency_overrides[get_webhook] = lambda: fake_webhook
    app.dependency_overrides[get_llm] = lambda: fake_llm
    app.dependency_overrides[get_asr] = lambda: fake_asr
    app.dependency_overrides[get_languagetool] = lambda: FakeLanguageToolClient()
    app.dependency_overrides[get_storage_dep] = lambda: LocalStorage(root=str(tmp_path))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api/english") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def loaded_items(test_engine):
    """Loads item_bank/*.json into the test DB so engine/API tests have items."""
    import json

    bank_dir = (
        Path(__file__).resolve().parent.parent.parent
        / "app"
        / "english"
        / "data"
        / "item_bank"
    )
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        for file in sorted(bank_dir.glob("*.json")):
            for raw in json.loads(file.read_text()):
                content, key = split_item(raw)
                session.add(
                    Item(
                        id=raw["id"],
                        section=raw["section"],
                        type=raw.get("type", raw.get("kind", "")),
                        stage=raw.get("stage", "single"),
                        cefr=raw.get("cefr", 3),
                        content=content,
                        key=key,
                        media_path=raw.get("audio") or raw.get("image"),
                        status=raw.get("status", "draft"),
                    )
                )
        await session.commit()


@pytest.fixture
def platform_headers():
    return {"X-API-Key": english_settings.platform_api_key}


@pytest.fixture
def admin_token():
    return create_admin_token(english_settings.admin_email)


def applicant_headers(applicant_id: str) -> dict:
    return {"Authorization": f"Bearer {create_applicant_token(applicant_id)}"}
