from datetime import date
from decimal import Decimal

import pytest

from app.english.core.errors import ValidationFailure
from app.english.ielts.rules import compute_overall, is_expired, round_ielts, validate_form


@pytest.mark.parametrize(
    "mean,expected",
    [
        (Decimal("6.25"), Decimal("6.5")),
        (Decimal("6.75"), Decimal("7.0")),
        (Decimal("6.125"), Decimal("6.0")),
        (Decimal("6.375"), Decimal("6.5")),
        (Decimal("3.875"), Decimal("4.0")),
    ],
)
def test_round_ielts(mean, expected):
    assert round_ielts(mean) == expected


def test_compute_overall_matches_official_examples():
    # Test taker A: 6.5, 6.5, 5.0, 7.0 -> 6.25 -> 6.5
    assert compute_overall(Decimal("6.5"), Decimal("6.5"), Decimal("5.0"), Decimal("7.0")) == Decimal("6.5")
    # Test taker C: 6.5, 6.5, 5.5, 6.0 -> 6.125 -> 6.0
    assert compute_overall(Decimal("6.5"), Decimal("6.5"), Decimal("5.5"), Decimal("6.0")) == Decimal("6.0")


def test_is_expired():
    assert is_expired(date(2022, 1, 1), date(2026, 1, 1)) is True
    assert is_expired(date(2025, 6, 1), date(2026, 1, 1)) is False


def test_validate_form_rejects_bad_trf_and_arithmetic():
    with pytest.raises(ValidationFailure) as exc:
        validate_form(
            trf_number="short",
            listening=6.5,
            reading=6.5,
            writing=5.0,
            speaking=7.0,
            overall=9.0,  # wrong, should be 6.5
            test_date=date(2026, 1, 1),
            today=date(2026, 6, 1),
        )
    codes = {p["field"]: p["code"] for p in exc.value.detail}
    assert codes["trf_number"] == "invalid_format"
    assert codes["overall"] == "arithmetic_mismatch"


def test_validate_form_accepts_valid_input():
    trf, l, r, w, s, o = validate_form(
        trf_number="123456789012345",
        listening=6.5,
        reading=6.5,
        writing=5.0,
        speaking=7.0,
        overall=6.5,
        test_date=date(2026, 1, 1),
        today=date(2026, 6, 1),
    )
    assert trf == "123456789012345"
    assert o == Decimal("6.5")


def test_validate_form_rejects_future_date():
    with pytest.raises(ValidationFailure) as exc:
        validate_form(
            trf_number="123456789012345",
            listening=6.5,
            reading=6.5,
            writing=6.5,
            speaking=6.5,
            overall=6.5,
            test_date=date(2027, 1, 1),
            today=date(2026, 6, 1),
        )
    codes = {p["field"] for p in exc.value.detail}
    assert "test_date" in codes
