"""Module 2: the test-engine state machine. The server owns every deadline;
the client only displays it."""

from datetime import datetime, timedelta, timezone

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.english.config import english_settings
from app.english.core.errors import conflict
from app.english.domain.enums import SECTION_ORDER, Section, SessionState, Stage
from app.english.infra.models import Item, Response, TestSession

STATE_FOR_SECTION = {
    Section.LISTENING: SessionState.LISTENING,
    Section.READING: SessionState.READING,
    Section.WRITING: SessionState.WRITING,
    Section.SPEAKING: SessionState.SPEAKING,
}

_ROUTING_STAGE_COUNT = {Section.LISTENING: 2, Section.READING: 1}
_STAGE2_STAGE_COUNT = {Section.LISTENING: 2, Section.READING: 1}
_HARD_THRESHOLD = {Section.LISTENING: 3, Section.READING: 4}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


async def _pick_items(db: AsyncSession, section: Section, stage: Stage, count: int, exclude: list[str] | None = None) -> list[Item]:
    result = await db.execute(
        select(Item)
        .where(Item.section == section, Item.stage == stage, Item.status == "approved")
        .where(Item.id.not_in(exclude) if exclude else True)
        .order_by(Item.exposure_count.asc())
    )
    items = list(result.scalars())[:count]
    for item in items:
        item.exposure_count += 1
        db.add(item)
    return items


async def build_form(db: AsyncSession, ts: TestSession) -> None:
    listening_routing = await _pick_items(db, Section.LISTENING, Stage.ROUTING, _ROUTING_STAGE_COUNT[Section.LISTENING])
    reading_routing = await _pick_items(db, Section.READING, Stage.ROUTING, _ROUTING_STAGE_COUNT[Section.READING])
    writing_items = await _pick_items(db, Section.WRITING, Stage.SINGLE, 1)

    speaking_items: list[Item] = []
    for kind in ("personal", "picture", "opinion"):
        result = await db.execute(
            select(Item)
            .where(Item.section == Section.SPEAKING, Item.type == kind, Item.status == "approved")
            .order_by(Item.exposure_count.asc())
        )
        item = result.scalars().first()
        if item:
            item.exposure_count += 1
            db.add(item)
            speaking_items.append(item)

    if len(listening_routing) != 2 or not reading_routing or not writing_items or len(speaking_items) != 3:
        raise conflict("item_bank_incomplete")

    ts.form = {
        "listening": {"routing": [i.id for i in listening_routing], "stage2": []},
        "reading": {"routing": [i.id for i in reading_routing], "stage2": []},
        "writing": {"items": [i.id for i in writing_items]},
        "speaking": {"items": [i.id for i in speaking_items]},
    }
    ts.route = {"listening": None, "reading": None}
    db.add(ts)
    await db.commit()
    await db.refresh(ts)


async def start_next_section(db: AsyncSession, ts: TestSession) -> Section | None:
    if ts.current_section is None:
        next_section = SECTION_ORDER[0]
    else:
        idx = SECTION_ORDER.index(Section(ts.current_section))
        if idx + 1 >= len(SECTION_ORDER):
            ts.state = SessionState.GRADING
            ts.current_section = None
            db.add(ts)
            await db.commit()
            return None
        next_section = SECTION_ORDER[idx + 1]

    ts.current_section = next_section
    ts.state = STATE_FOR_SECTION[next_section]
    now = _now()
    deadline = now + timedelta(seconds=english_settings.section_seconds)
    started = dict(ts.section_started_at)
    deadlines = dict(ts.section_deadline)
    started[next_section.value] = now.isoformat()
    deadlines[next_section.value] = deadline.isoformat()
    ts.section_started_at = started
    ts.section_deadline = deadlines
    db.add(ts)
    await db.commit()
    await db.refresh(ts)
    return next_section


def section_deadline(ts: TestSession, section: Section) -> datetime | None:
    raw = ts.section_deadline.get(section.value)
    return datetime.fromisoformat(raw) if raw else None


def is_past_deadline(ts: TestSession, section: Section, now: datetime | None = None) -> bool:
    now = now or _now()
    deadline = section_deadline(ts, section)
    if deadline is None:
        return False
    return _aware(now) > _aware(deadline) + timedelta(seconds=english_settings.section_grace_seconds)


async def current_stage(db: AsyncSession, ts: TestSession) -> Stage:
    section = Section(ts.current_section)
    if section in (Section.WRITING, Section.SPEAKING):
        return Stage.SINGLE
    route = ts.route.get(section.value)
    return Stage.ROUTING if route is None else Stage(route)


async def get_current_items(db: AsyncSession, ts: TestSession) -> tuple[list[Item], Stage]:
    section = Section(ts.current_section)
    stage = await current_stage(db, ts)
    if section in (Section.WRITING, Section.SPEAKING):
        ids = ts.form[section.value]["items"]
    elif stage == Stage.ROUTING:
        ids = ts.form[section.value]["routing"]
    else:
        ids = ts.form[section.value]["stage2"]
    result = await db.execute(select(Item).where(Item.id.in_(ids)))
    by_id = {i.id: i for i in result.scalars()}
    items = [by_id[i] for i in ids if i in by_id]
    return items, stage


def client_view(items: list[Item]) -> list[dict]:
    return [{"id": i.id, "type": i.type, "cefr": i.cefr, **i.content} for i in items]


async def _route_after_routing(db: AsyncSession, ts: TestSession, section: Section) -> None:
    result = await db.execute(
        select(Response).where(Response.session_id == ts.id, Response.section == section, Response.stage == Stage.ROUTING)
    )
    responses = list(result.scalars())
    correct_count = sum(r.grade.get("correct_count", 0) for r in responses)
    route = "hard" if correct_count >= _HARD_THRESHOLD[section] else "easy"

    routing_ids = ts.form[section.value]["routing"]
    stage2_items = await _pick_items(db, section, Stage(route), _STAGE2_STAGE_COUNT[section], exclude=routing_ids)

    form = dict(ts.form)
    form[section.value] = dict(form[section.value])
    form[section.value]["stage2"] = [i.id for i in stage2_items]
    ts.form = form

    new_route = dict(ts.route)
    new_route[section.value] = route
    ts.route = new_route
    db.add(ts)
    await db.commit()
    await db.refresh(ts)


class UnknownItem(Exception):
    pass


async def submit_answers(db: AsyncSession, ts: TestSession, answers: list[dict]) -> dict:
    section = Section(ts.current_section)
    if is_past_deadline(ts, section):
        return await expire_section(db, ts)
    late = False
    from app.english.grading.objective import grade_objective_response

    items, stage = await get_current_items(db, ts)
    by_id = {i.id: i for i in items}

    already = await db.execute(
        select(Response.item_id).where(Response.session_id == ts.id, Response.section == section, Response.stage == stage)
    )
    already_ids = set(already.scalars())

    if len({a["item_id"] for a in answers}) != len(answers):
        raise conflict("duplicate_answer")
    for a in answers:
        item = by_id.get(a["item_id"])
        if item is None:
            raise conflict("item_not_in_current_stage")
        if item.id in already_ids:
            continue
        correct = None
        grade = {}
        if section in (Section.LISTENING, Section.READING):
            correct, grade = grade_objective_response(item, a["answer"])
        db.add(
            Response(
                session_id=ts.id,
                item_id=item.id,
                section=section,
                stage=stage,
                answer={"value": a["answer"], "late": late} if late else {"value": a["answer"]},
                correct=correct,
                grade=grade,
            )
        )
    await db.commit()

    if section in (Section.LISTENING, Section.READING) and stage == Stage.ROUTING:
        await _route_after_routing(db, ts, section)
        items2, stage2 = await get_current_items(db, ts)
        return {"section_complete": False, "stage": stage2.value, "items": client_view(items2)}

    next_section = await start_next_section(db, ts)
    if next_section is None:
        return {"section_complete": True, "next_section": None, "state": "grading"}
    items3, stage3 = await get_current_items(db, ts)
    return {
        "section_complete": True,
        "next_section": next_section.value,
        "stage": stage3.value,
        "items": client_view(items3),
        "deadline": ts.section_deadline[next_section.value],
    }


async def expire_section(db: AsyncSession, ts: TestSession) -> dict:
    section = ts.current_section
    ts.flags = {**ts.flags, str(section): ["section_expired"]}
    next_section = await start_next_section(db, ts)
    if next_section is None:
        return {"section_complete": True, "next_section": None, "state": "grading", "expired": True}
    items, stage = await get_current_items(db, ts)
    return {
        "section_complete": True,
        "next_section": next_section.value,
        "stage": stage.value,
        "items": client_view(items),
        "deadline": ts.section_deadline[next_section.value],
        "expired": True,
    }
