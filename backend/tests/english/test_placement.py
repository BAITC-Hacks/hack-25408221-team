from app.english.domain.placement import decide_placement, is_borderline


def test_bachelor_when_mean_and_floor_met():
    levels = {"listening": 4, "reading": 4, "writing": 4, "speaking": 4}  # all B2
    assert decide_placement(levels).value == "BACHELOR"


def test_foundation_when_one_skill_too_low_even_if_mean_ok():
    levels = {"listening": 6, "reading": 6, "writing": 6, "speaking": 2}  # mean 5, but speaking A2
    assert decide_placement(levels).value == "FOUNDATION"


def test_foundation_when_mean_too_low():
    levels = {"listening": 3, "reading": 3, "writing": 3, "speaking": 3}  # mean B1
    assert decide_placement(levels).value == "FOUNDATION"


def test_borderline_flips_with_one_level_nudge():
    # mean exactly 4, all >= 3: BACHELOR. Nudge speaking down to 3 -> mean 3.75 -> FOUNDATION.
    levels = {"listening": 4, "reading": 4, "writing": 4, "speaking": 4}
    assert is_borderline(levels) is True


def test_not_borderline_when_clearly_bachelor():
    levels = {"listening": 6, "reading": 6, "writing": 6, "speaking": 6}
    assert is_borderline(levels) is False


def test_not_borderline_when_clearly_foundation():
    levels = {"listening": 1, "reading": 1, "writing": 1, "speaking": 1}
    assert is_borderline(levels) is False
