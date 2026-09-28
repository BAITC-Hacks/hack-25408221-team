"""Module 3 + Module 4 tie-together: grades a finished session end to end
and decides placement / review routing."""

import asyncio
from datetime import datetime, timezone
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.english.config import english_settings
from app.english.domain.enums import (
    IntegrityLevel,
    Placement,
    PlacementSource,
    Section,
    SessionState,
    Stage,
)
from app.english.domain.placement import decide_placement, is_borderline
from app.english.grading.aggregate import objective_level
from app.english.grading.speaking import grade_speaking
from app.english.grading.writing import grade_writing
from app.english.infra.asr import ASRClient
from app.english.infra.languagetool import LanguageToolClient
from app.english.infra.llm import LLMClient
from app.english.infra.models import Applicant, Item, Response, TestSession, ProctorEvent
from app.english.infra.storage import Storage
from app.english.infra.webhook import WebhookSender
from app.english.proctor.integrity import score_events


async def grade_session(
    db: AsyncSession,
    ts: TestSession,
    *,
    llm: LLMClient,
    asr: ASRClient,
    languagetool: LanguageToolClient,
    webhook: WebhookSender,
    storage: Storage,
) -> TestSession:
    grading_started = datetime.utcnow()
    levels: dict[str, int | None] = {}
    flags: dict[str, list[str]] = dict(ts.flags)

    for section in (Section.LISTENING, Section.READING):
        route = ts.route.get(section.value) or "easy"
        levels[section.value] = await objective_level(db, ts.id, section, route)
        if levels[section.value] is None:
            flags[section.value] = flags.get(section.value, []) + ["no_scored_response"]

    # Writing
    wresult = await db.execute(
        select(Response).where(Response.session_id == ts.id, Response.section == Section.WRITING)
    )
    wresponse = wresult.scalars().first()
    if wresponse:
        item = await db.get(Item, wresponse.item_id)
        essay = wresponse.answer.get("value", "")
        try:
            wgrade = await asyncio.wait_for(grade_writing(essay, item.content.get("prompt", ""), llm, languagetool), 120)
        except Exception:
            wgrade = {"level": None, "flags": ["service_unavailable"], "rationale": ["Writing assessment unavailable. Review the submitted answer."]}
        wresponse.grade = wgrade
        db.add(wresponse)
        levels["writing"] = wgrade["level"]
        flags["writing"] = flags.get("writing", []) + wgrade["flags"]
    else:
        levels["writing"] = None
        flags["writing"] = ["no_response"]

    # Speaking
    sresult = await db.execute(
        select(Response).where(Response.session_id == ts.id, Response.section == Section.SPEAKING)
    )
    sresponses = list(sresult.scalars())
    if sresponses:
        answers = []
        for r in sresponses:
            item = await db.get(Item, r.item_id)
            audio_path = storage.local_path(r.media_path) if r.media_path else ""
            answers.append(
                {"task": item.type, "audio_path": audio_path, "prompt": item.content.get("prompt", "")}
            )
        try:
            sgrade = await asyncio.wait_for(grade_speaking(answers, asr, llm), 180)
        except Exception:
            sgrade = {"level": None, "flags": ["service_unavailable"], "rationale": ["Speaking assessment unavailable. Review the recording."]}
        levels["speaking"] = sgrade["level"]
        flags["speaking"] = flags.get("speaking", []) + sgrade["flags"]
        sresponses[-1].grade = sgrade
        db.add(sresponses[-1])
    else:
        levels["speaking"] = None
        flags["speaking"] = ["no_response"]

    for skill in levels:
        if not levels[skill] or "grade_invalid" in flags.get(skill, []):
            levels[skill] = None
    complete = all(isinstance(v, int) and 1 <= v <= 6 for v in levels.values())
    ts.levels = levels
    ts.flags = flags

    integrity_score, integrity_level = await score_events(db, ts.id)
    ts.integrity_score = integrity_score
    ts.integrity_level = integrity_level

    placement = decide_placement(levels) if complete else None
    ts.placement = placement

    grader_flagged = any(bool(f) for f in flags.values())
    needs_review = (
        not complete
        or (complete and is_borderline(levels))
        or grader_flagged
        or integrity_level in (IntegrityLevel.AMBER, IntegrityLevel.RED)
    )

    applicant = await db.get(Applicant, ts.applicant_id)

    events = list((await db.execute(select(ProctorEvent).where(ProctorEvent.session_id == ts.id).order_by(ProctorEvent.ts_server))).scalars())
    beats = [e.ts_server for e in events if e.type == "heartbeat"]
    now = grading_started
    aware = lambda dt: dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    coverage_gap = not beats or (aware(now) - aware(beats[-1])).total_seconds() > 90
    starts = [datetime.fromisoformat(value) for value in ts.section_started_at.values()]
    if beats and starts and (aware(beats[0])-min(aware(d) for d in starts)).total_seconds()>45:
        coverage_gap = True
    coverage_gap = coverage_gap or any((aware(b)-aware(a)).total_seconds()>45 for a,b in zip(beats,beats[1:]))
    if coverage_gap:
        ts.flags = {**ts.flags, "integrity": ["monitoring_gap_or_unavailable"]}
        ts.integrity_level = IntegrityLevel.AMBER if integrity_level == IntegrityLevel.GREEN else integrity_level
        needs_review = True
    if any(e.type not in {"heartbeat", "condition_restored"} for e in events):
        needs_review = True
    if not english_settings.auto_placement_enabled:
        ts.flags = {**ts.flags, "assessment": ["provisional_requires_human_confirmation"]}
        needs_review = True

    if needs_review:
        ts.state = SessionState.NEEDS_REVIEW
        applicant.state = "needs_review"
    else:
        ts.state = SessionState.DECIDED
        applicant.placement = placement
        applicant.placement_source = PlacementSource.TEST
        applicant.state = "placed"
        await db.commit()
        try:
            await webhook.send(
                {
                    "external_id": applicant.external_id,
                    "placement": placement.value if hasattr(placement, "value") else str(placement),
                    "source": "test",
                    "levels": levels,
                }
            )
        except Exception:
            ts.flags = {**ts.flags, "delivery": ["webhook_failed"]}

    db.add(ts)
    db.add(applicant)
    await db.commit()
    await db.refresh(ts)
    return ts
