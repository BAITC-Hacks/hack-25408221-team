"""Module 4: integrity scoring from logged proctor events."""

import functools
import yaml
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.english.config import english_settings
from app.english.domain.enums import IntegrityLevel
from app.english.infra.models import ProctorEvent


@functools.lru_cache
def _config() -> dict:
    with open(english_settings.integrity_weights_path) as f:
        return yaml.safe_load(f)


def score_event_list(events: list[dict]) -> tuple[int, IntegrityLevel]:
    weights = _config()["weights"]
    thresholds = _config()["thresholds"]
    total = 0
    for e in events:
        etype = e["type"]
        if etype == "tab_hidden":
            duration_s = e.get("data", {}).get("duration_s", 0)
            total += weights["tab_hidden_base"] + weights["tab_hidden_per_10s"] * (duration_s // 10)
        elif etype in weights:
            total += weights[etype]
    total = int(total)
    if total >= thresholds["red"]:
        level = IntegrityLevel.RED
    elif total >= thresholds["amber"]:
        level = IntegrityLevel.AMBER
    else:
        level = IntegrityLevel.GREEN
    return total, level


async def score_events(db: AsyncSession, session_id: str) -> tuple[int, IntegrityLevel]:
    result = await db.execute(select(ProctorEvent).where(ProctorEvent.session_id == session_id))
    events = [
        {"type": e.type, "data": e.data} for e in result.scalars()
    ]
    return score_event_list(events)
