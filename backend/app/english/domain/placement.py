from app.english.config import english_settings
from app.english.domain.enums import Placement, Section


def decide_placement(levels: dict[str, int]) -> Placement:
    values = [levels[s.value] for s in Section]
    mean = sum(values) / len(values)
    if mean >= english_settings.placement_min_mean and all(
        v >= english_settings.placement_min_skill for v in values
    ):
        return Placement.BACHELOR
    return Placement.FOUNDATION


def is_borderline(levels: dict[str, int]) -> bool:
    """True if nudging any one skill up or down by one level would flip the placement."""
    base = decide_placement(levels)
    for section in Section:
        for delta in (-1, 1):
            nudged = dict(levels)
            nudged[section.value] = levels[section.value] + delta
            if nudged[section.value] < 1 or nudged[section.value] > 6:
                continue
            if decide_placement(nudged) != base:
                return True
    return False
