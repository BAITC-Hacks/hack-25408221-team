"""Pure field-validation functions for Module 1 (IELTS check). No I/O here."""

import re
from datetime import date
from decimal import ROUND_FLOOR, Decimal

TRF_RE = re.compile(r"^[A-Z0-9]{15,18}$")
MIN_TEST_DATE = date(2000, 1, 1)


class FieldProblem(Exception):
    def __init__(self, field: str, code: str):
        self.field = field
        self.code = code
        super().__init__(f"{field}:{code}")


def normalize_trf(raw: str) -> str:
    return raw.replace(" ", "").upper()


def validate_trf(raw: str) -> str:
    trf = normalize_trf(raw)
    if not TRF_RE.match(trf):
        raise FieldProblem("trf_number", "invalid_format")
    return trf


def validate_band(value, field: str) -> Decimal:
    d = Decimal(str(value))
    if d < 0 or d > 9:
        raise FieldProblem(field, "out_of_range")
    if (d * 2) % 1 != 0:
        raise FieldProblem(field, "invalid_step")
    return d


def round_ielts(mean: Decimal) -> Decimal:
    """Official IELTS rounding: the average of the four bands rounds to the
    nearest half band; .25 rounds up to .5, .75 rounds up to the next whole
    band. Equivalent to floor(2x + 0.5) / 2."""
    doubled = (mean * 2 + Decimal("0.5")).to_integral_value(rounding=ROUND_FLOOR)
    return doubled / 2


def compute_overall(listening: Decimal, reading: Decimal, writing: Decimal, speaking: Decimal) -> Decimal:
    mean = (listening + reading + writing + speaking) / 4
    return round_ielts(mean)


def validate_test_date(value: date, today: date) -> date:
    if value > today:
        raise FieldProblem("test_date", "in_future")
    if value < MIN_TEST_DATE:
        raise FieldProblem("test_date", "too_old")
    return value


def is_expired(test_date: date, application_deadline: date) -> bool:
    two_years_later = date(test_date.year + 2, test_date.month, test_date.day)
    return two_years_later < application_deadline


def validate_form(
    *,
    trf_number: str,
    listening,
    reading,
    writing,
    speaking,
    overall,
    test_date: date,
    today: date,
) -> tuple[str, Decimal, Decimal, Decimal, Decimal, Decimal]:
    problems: list[dict] = []
    trf = None
    bands: dict[str, Decimal] = {}

    try:
        trf = validate_trf(trf_number)
    except FieldProblem as e:
        problems.append({"field": e.field, "code": e.code})

    for field, value in [
        ("listening", listening),
        ("reading", reading),
        ("writing", writing),
        ("speaking", speaking),
    ]:
        try:
            bands[field] = validate_band(value, field)
        except FieldProblem as e:
            problems.append({"field": e.field, "code": e.code})

    try:
        overall_d = validate_band(overall, "overall")
    except FieldProblem as e:
        problems.append({"field": e.field, "code": e.code})
        overall_d = None

    try:
        validate_test_date(test_date, today)
    except FieldProblem as e:
        problems.append({"field": e.field, "code": e.code})

    if len(bands) == 4 and overall_d is not None:
        expected = compute_overall(bands["listening"], bands["reading"], bands["writing"], bands["speaking"])
        if expected != overall_d:
            problems.append({"field": "overall", "code": "arithmetic_mismatch"})

    if problems:
        from app.english.core.errors import ValidationFailure

        raise ValidationFailure(problems)

    return (
        trf,
        bands["listening"],
        bands["reading"],
        bands["writing"],
        bands["speaking"],
        overall_d,
    )
