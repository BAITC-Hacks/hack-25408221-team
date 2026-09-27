"""LLM client interface. Real implementation calls Gemini; tests use a fake
that returns scripted JSON so grading logic can be tested with no network call."""

import asyncio
from typing import Protocol

from app.config import settings
from app.english.config import english_settings


class LLMClient(Protocol):
    async def complete_json(self, system: str, user: str, temperature: float = 0.0) -> str:
        """Returns raw text expected to be JSON; caller validates/parses it."""
        ...


class GeminiLLMClient:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.gemini_api_key
        self.model = model or english_settings.gemini_model
        self._client = None

    def _ensure_client(self):
        if self._client is None:
            from google import genai

            self._client = genai.Client(
                api_key=self.api_key,
                http_options={"timeout": 25000, "retry_options": {"attempts": 1}},
            )
        return self._client

    async def complete_json(self, system: str, user: str, temperature: float = 0.0) -> str:
        client = self._ensure_client()
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=self.model,
                contents=user,
                config={
                    "system_instruction": system,
                    "temperature": temperature,
                    "response_mime_type": "application/json",
                },
            ),
            timeout=30,
        )
        return response.text or "{}"


class FakeLLMClient:
    """Test/dev double. `script` is a list of responses returned in order,
    one per call; a callable script is called with (system, user) instead."""

    def __init__(self, script=None):
        self.script = script or []
        self.calls: list[tuple[str, str, float]] = []
        self._i = 0

    async def complete_json(self, system: str, user: str, temperature: float = 0.0) -> str:
        self.calls.append((system, user, temperature))
        if callable(self.script):
            return self.script(system, user)
        if self._i < len(self.script):
            item = self.script[self._i]
            self._i += 1
            return item
        return self.script[-1] if self.script else "{}"


def get_llm_client() -> LLMClient:
    if settings.gemini_api_key:
        return GeminiLLMClient()
    return FakeLLMClient()
