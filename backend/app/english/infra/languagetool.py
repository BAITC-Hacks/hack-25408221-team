from typing import Protocol

import httpx

from app.english.config import english_settings


class LanguageToolClient(Protocol):
    async def error_count(self, text: str, language: str = "en-US") -> int: ...


class HTTPLanguageToolClient:
    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or english_settings.languagetool_url

    async def error_count(self, text: str, language: str = "en-US") -> int:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{self.base_url}/v2/check", data={"text": text, "language": language}
            )
            resp.raise_for_status()
            return len(resp.json().get("matches", []))


class FakeLanguageToolClient:
    def __init__(self, errors_per_100: float = 2.0):
        self.errors_per_100 = errors_per_100

    async def error_count(self, text: str, language: str = "en-US") -> int:
        words = max(len(text.split()), 1)
        return round(self.errors_per_100 * words / 100)


def get_languagetool_client() -> LanguageToolClient:
    if english_settings.languagetool_backend == "http":
        return HTTPLanguageToolClient()
    return FakeLanguageToolClient()
