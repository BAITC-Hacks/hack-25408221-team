from datetime import date, timezone
from decimal import Decimal

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.english.config import english_settings
from app.english.domain.enums import (
    ApplicantState,
    IeltsVerdict,
    Placement,
    PlacementSource,
)
from app.english.ielts.rules import is_expired, validate_form
from app.english.ielts.verifier import IeltsVerifier, VerifierUnavailable
from app.english.infra.models import Applicant, IeltsCheck
from app.english.infra.webhook import WebhookSender


def _normalize_name(name: str) -> str:
    import unicodedata

    return unicodedata.normalize("NFKC", name).strip().casefold()


async def run_ielts_check(
    *,
    session: AsyncSession,
    applicant: Applicant,
    verifier: IeltsVerifier,
    webhook: WebhookSender,
    trf_number: str,
    family_name: str,
    date_of_birth: date,
    test_date: date,
    module: str,
    listening,
    reading,
    writing,
    speaking,
    overall,
    today: date | None = None,
) -> IeltsCheck:
    today = today or date.today()

    trf, l, r, w, s, o = validate_form(
        trf_number=trf_number,
        listening=listening,
        reading=reading,
        writing=writing,
        speaking=speaking,
        overall=overall,
        test_date=test_date,
        today=today,
    )

    check = IeltsCheck(
        applicant_id=applicant.id,
        trf_number=trf,
        family_name=family_name,
        date_of_birth=date_of_birth,
        test_date=test_date,
        module=module,
        listening=float(l),
        reading=float(r),
        writing=float(w),
        speaking=float(s),
        overall=float(o),
        verdict=IeltsVerdict.PENDING,
        attempts=1,
    )

    # Step 1: expiry check happens before calling the API at all.
    if is_expired(test_date, english_settings.application_deadline):
        check.verdict = IeltsVerdict.EXPIRED
        check.reason = "older_than_2_years"
        applicant.state = ApplicantState.NEEDS_TEST
        session.add(check)
        session.add(applicant)
        await session.commit()
        await session.refresh(check)
        return check

    # Step 2: call the verifier.
    try:
        record = await verifier.lookup(trf, family_name, date_of_birth)
    except VerifierUnavailable:
        check.verdict = IeltsVerdict.PENDING
        applicant.state = ApplicantState.IELTS_PENDING
        session.add(check)
        session.add(applicant)
        await session.commit()
        await session.refresh(check)
        return check

    # Step 3: no match.
    if record is None:
        check.verdict = IeltsVerdict.NOT_VERIFIED
        check.reason = "not_found"
        applicant.state = ApplicantState.NEEDS_TEST
        session.add(check)
        session.add(applicant)
        await session.commit()
        await session.refresh(check)
        return check

    # Step 4: identity match.
    if _normalize_name(record.family_name) != _normalize_name(family_name) or record.date_of_birth != date_of_birth:
        check.verdict = IeltsVerdict.NOT_VERIFIED
        check.reason = "identity_mismatch"
        applicant.state = ApplicantState.NEEDS_TEST
        session.add(check)
        session.add(applicant)
        await session.commit()
        await session.refresh(check)
        return check

    # Never let user-entered dates bypass the authoritative record's expiry.
    if is_expired(record.test_date, english_settings.application_deadline):
        check.verdict = IeltsVerdict.EXPIRED
        check.reason = "older_than_2_years"
        applicant.state = ApplicantState.NEEDS_TEST
        session.add(check)
        session.add(applicant)
        await session.commit()
        await session.refresh(check)
        return check
    if record.test_date != test_date or record.module != module:
        check.verdict = IeltsVerdict.NOT_VERIFIED
        check.reason = "test_details_mismatch"
        applicant.state = ApplicantState.NEEDS_TEST
        session.add(check)
        session.add(applicant)
        await session.commit()
        await session.refresh(check)
        return check

    # Step 5: score match (only if the record carries bands).
    record_bands = [record.listening, record.reading, record.writing, record.speaking, record.overall]
    form_bands = [l, r, w, s, o]
    if any(b is None for b in record_bands):
        check.reason = "provider_scores_unavailable"
        applicant.state = ApplicantState.IELTS_PENDING
        session.add(check)
        session.add(applicant)
        await session.commit()
        await session.refresh(check)
        return check
    if all(b is not None for b in record_bands):
        if [Decimal(str(b)) for b in record_bands] != form_bands:
            check.verdict = IeltsVerdict.NOT_VERIFIED
            check.reason = "scores_mismatch"
            applicant.state = ApplicantState.NEEDS_TEST
            session.add(check)
            session.add(applicant)
            await session.commit()
            await session.refresh(check)
            return check

    # Step 6: verified. The record's values are authoritative.
    verified_overall = record.overall if record.overall is not None else o
    check.verdict = IeltsVerdict.VERIFIED
    check.verifier_record = {
        "family_name": record.family_name,
        "date_of_birth": record.date_of_birth.isoformat(),
        "test_date": record.test_date.isoformat(),
        "module": record.module.value if hasattr(record.module, "value") else str(record.module),
        "overall": float(verified_overall) if verified_overall is not None else None,
    }
    applicant.state = ApplicantState.PLACED
    applicant.placement_source = PlacementSource.IELTS
    applicant.placement = (
        Placement.BACHELOR
        if float(verified_overall) >= english_settings.ielts_bachelor_min_overall
        else Placement.FOUNDATION
    )
    session.add(check)
    session.add(applicant)
    await session.commit()
    await session.refresh(check)
    await session.refresh(applicant)

    await webhook.send(
        {
            "external_id": applicant.external_id,
            "placement": applicant.placement.value if hasattr(applicant.placement, "value") else str(applicant.placement),
            "source": applicant.placement_source.value if hasattr(applicant.placement_source, "value") else str(applicant.placement_source),
        }
    )

    return check
