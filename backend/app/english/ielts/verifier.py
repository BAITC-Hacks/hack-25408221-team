import json
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Optional, Protocol

from app.english.config import english_settings
from app.english.domain.enums import IeltsModule


@dataclass
class IeltsRecord:
    trf_number: str
    family_name: str
    date_of_birth: date
    test_date: date
    module: IeltsModule
    listening: Optional[Decimal]
    reading: Optional[Decimal]
    writing: Optional[Decimal]
    speaking: Optional[Decimal]
    overall: Optional[Decimal]


class VerifierUnavailable(Exception):
    pass


class IeltsVerifier(Protocol):
    async def lookup(
        self, trf_number: str, family_name: str, date_of_birth: date
    ) -> Optional[IeltsRecord]: ...


def _parse_decimal(v):
    return Decimal(str(v)) if v is not None else None


class MockIeltsVerifier:
    def __init__(self, fixtures_path: str | None = None, fixtures: dict | None = None):
        if fixtures is not None:
            self._records = fixtures
        else:
            path = fixtures_path or english_settings.ielts_fixtures_path
            try:
                with open(path) as f:
                    self._records = json.load(f)
            except FileNotFoundError:
                self._records = {}

    async def lookup(
        self, trf_number: str, family_name: str, date_of_birth: date
    ) -> Optional[IeltsRecord]:
        raw = self._records.get(trf_number)
        if raw is None:
            return None
        return IeltsRecord(
            trf_number=trf_number,
            family_name=raw["family_name"],
            date_of_birth=date.fromisoformat(raw["date_of_birth"]),
            test_date=date.fromisoformat(raw["test_date"]),
            module=IeltsModule(raw["module"]),
            listening=_parse_decimal(raw.get("listening")),
            reading=_parse_decimal(raw.get("reading")),
            writing=_parse_decimal(raw.get("writing")),
            speaking=_parse_decimal(raw.get("speaking")),
            overall=_parse_decimal(raw.get("overall")),
        )


class IeltsApiVerifier:
    async def lookup(
        self, trf_number: str, family_name: str, date_of_birth: date
    ) -> Optional[IeltsRecord]:
        raise VerifierUnavailable(
            "IeltsApiVerifier is a stub; register with the IELTS Results "
            "Service and implement this before switching IELTS_VERIFIER=api"
        )


def get_ielts_verifier() -> IeltsVerifier:
    if english_settings.ielts_verifier == "api":
        return IeltsApiVerifier()
    return MockIeltsVerifier()
