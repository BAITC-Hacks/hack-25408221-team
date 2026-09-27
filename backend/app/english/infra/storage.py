import os
from pathlib import Path
from typing import Protocol

from app.english.config import english_settings


class Storage(Protocol):
    async def save(self, path: str, data: bytes) -> str: ...
    async def url(self, path: str, expiry_seconds: int = 3600) -> str: ...
    def local_path(self, path: str) -> str: ...


class LocalStorage:
    def __init__(self, root: str | None = None):
        self.root = Path(root or english_settings.storage_local_path)
        self.root.mkdir(parents=True, exist_ok=True)

    async def save(self, path: str, data: bytes) -> str:
        full = Path(self.local_path(path))
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_bytes(data)
        return path

    async def url(self, path: str, expiry_seconds: int = 3600) -> str:
        return f"/api/english/media/{path}"

    def local_path(self, path: str) -> str:
        root = self.root.resolve()
        full = (root / path).resolve()
        if not full.is_relative_to(root):
            raise ValueError("Invalid storage path")
        return str(full)


def get_storage() -> Storage:
    return LocalStorage()
