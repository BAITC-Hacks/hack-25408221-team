"""Loads config/cefr_cuts.yaml and looks up a CEFR level from a raw score."""

import functools
import yaml

from app.english.config import english_settings


@functools.lru_cache
def _cuts() -> dict:
    with open(english_settings.cefr_cuts_path) as f:
        return yaml.safe_load(f)


def cefr_for(section: str, route: str, correct: int) -> int:
    table = _cuts()[section][route]
    max_key = max(table.keys())
    key = min(correct, max_key)
    return table[key]
