"""Loads English Gate item bank and showcase demo applicants into the database.
Run as: python -m app.scripts.seed_english
"""

import asyncio
import json
import logging
from pathlib import Path

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.english.config import english_settings
from app.english.domain.enums import ApplicantState, Section, SessionState, Stage
from app.english.infra.models import (
    Applicant,
    Item,
    ProctorEvent,
    Response,
    TestSession,
)
from app.english.test_engine.item_loading import split_item
from app.infrastructure.database import get_session, init_db

logger = logging.getLogger(__name__)


async def seed_items(session: AsyncSession) -> int:
    item_bank_dir = Path(english_settings.item_bank_dir)
    count = 0
    for file in sorted(item_bank_dir.glob("*.json")):
        records = json.loads(file.read_text())
        for raw in records:
            content, key = split_item(raw)
            existing = await session.get(Item, raw["id"])
            if existing:
                existing.content = content
                existing.key = key
                existing.status = raw.get("status", "draft")
                session.add(existing)
            else:
                session.add(
                    Item(
                        id=raw["id"],
                        section=raw["section"],
                        type=raw.get("type", raw.get("kind", "")),
                        stage=raw.get("stage", "single"),
                        cefr=raw.get("cefr", 3),
                        content=content,
                        key=key,
                        media_path=raw.get("audio") or raw.get("image"),
                        status=raw.get("status", "draft"),
                    )
                )
            count += 1
    await session.commit()
    return count


async def seed_showcase(session: AsyncSession) -> None:
    samples = [
        (
            "ready",
            "Demo · Amina Karim",
            {"listening": 4, "reading": 4, "writing": 4, "speaking": 4},
            "BACHELOR",
            "green",
        ),
        (
            "support",
            "Demo · Daniyar Ali",
            {"listening": 3, "reading": 3, "writing": 2, "speaking": 3},
            "FOUNDATION",
            "green",
        ),
        (
            "review",
            "Demo · Sofia Lee",
            {"listening": 4, "reading": 5, "writing": None, "speaking": 4},
            None,
            "amber",
        ),
    ]

    for key, name, levels, placement, integrity in samples:
        external = f"showcase-{key}"
        existing = (
            await session.execute(select(Applicant).where(Applicant.external_id == external))
        ).scalars().first()
        if existing:
            continue
        a = Applicant(
            external_id=external,
            full_name=name,
            email=f"{key}@invision.demo",
            state=ApplicantState.NEEDS_REVIEW.value,
        )
        session.add(a)
        await session.flush()

        s = TestSession(
            applicant_id=a.id,
            state=SessionState.NEEDS_REVIEW.value,
            levels=levels,
            placement=placement,
            integrity_level=integrity,
            flags={
                "assessment": ["synthetic_demo_data", "provisional_requires_human_confirmation"],
                **({"writing": ["service_unavailable"]} if key == "review" else {}),
            },
        )
        session.add(s)
        await session.flush()

        text = (
            "I prefer studying in a small group because explaining an idea helps me understand it. "
            "We agree on a goal before each meeting and spend the last ten minutes checking our answers. "
            "Sometimes I study alone first so I can identify questions to discuss with my classmates."
        )
        session.add(
            Response(
                session_id=s.id,
                item_id="W-OP-002",
                section=Section.WRITING,
                stage=Stage.SINGLE,
                answer={"value": text},
                grade={
                    "level": levels.get("writing"),
                    "rationale": ["Synthetic showcase example for review screen demo."],
                    "criteria": {"coherence": {"median": levels.get("writing") or 0, "evidence": ["We agree on a goal before each meeting"]}},
                },
            )
        )
        session.add(
            ProctorEvent(session_id=s.id, seq=1, type="heartbeat", section=Section.WRITING, data={"synthetic": True})
        )
        if integrity == "amber":
            session.add(
                ProctorEvent(session_id=s.id, seq=2, type="window_blur", section=Section.WRITING, data={"synthetic": True})
            )
    await session.commit()


async def main():
    await init_db()
    async for session in get_session():
        items_count = await seed_items(session)
        await seed_showcase(session)
        print(f"English Gate seed complete: {items_count} items loaded and showcase applicants seeded.")
        break


if __name__ == "__main__":
    asyncio.run(main())
