"""Aggregates Listening/Reading stage2 responses into a CEFR level."""

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.english.domain.enums import Section, Stage
from app.english.grading.cefr import cefr_for
from app.english.infra.models import Response


async def objective_level(db: AsyncSession, session_id: str, section: Section, route: str) -> int | None:
    result = await db.execute(
        select(Response).where(
            Response.session_id == session_id, Response.section == section, Response.stage == Stage(route)
        )
    )
    responses = list(result.scalars())
    if not responses:
        return None
    correct = sum(r.grade.get("correct_count", 0) for r in responses)
    return cefr_for(section.value, route, correct)
