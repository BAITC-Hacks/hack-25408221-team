import hashlib
import hmac
import json
from typing import Protocol

import httpx

from app.english.config import english_settings


class WebhookSender(Protocol):
    async def send(self, payload: dict) -> None: ...


def sign(payload: dict, secret: str) -> str:
    body = json.dumps(payload, sort_keys=True, default=str).encode()
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


class HTTPWebhookSender:
    def __init__(self, url: str | None = None, secret: str | None = None):
        self.url = url or english_settings.platform_webhook_url
        self.secret = secret or english_settings.webhook_secret

    async def send(self, payload: dict) -> None:
        if not self.url:
            return
        signature = sign(payload, self.secret)
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                self.url, json=payload, headers={"X-Signature": signature}
            )


class FakeWebhookSender:
    def __init__(self):
        self.sent: list[dict] = []

    async def send(self, payload: dict) -> None:
        self.sent.append(payload)


def get_webhook_sender() -> WebhookSender:
    return HTTPWebhookSender()
