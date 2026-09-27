from app.english.grading.cefr import cefr_for
from app.english.infra.models import Item
from app.english.grading.objective import grade_objective_response


def _mcq_item():
    return Item(
        id="X", section="listening", type="clip", stage="routing", cefr=3,
        content={}, key={"questions": [
            {"id": "q1", "answer": 1},
            {"id": "q2", "accept": ["six", "6"]},
        ]},
    )


def test_grade_objective_all_correct():
    item = _mcq_item()
    correct, grade = grade_objective_response(item, {"q1": 1, "q2": "Six"})
    assert correct is True
    assert grade["correct_count"] == 2


def test_grade_objective_partial():
    item = _mcq_item()
    correct, grade = grade_objective_response(item, {"q1": 0, "q2": "six"})
    assert correct is False
    assert grade["correct_count"] == 1


def test_grade_objective_missing_answer():
    item = _mcq_item()
    correct, grade = grade_objective_response(item, {"q1": 1})
    assert correct is False
    assert grade["correct_count"] == 1


def test_grade_ctest():
    item = Item(
        id="R-CT", section="reading", type="ctest", stage="routing", cefr=3,
        content={}, key={"segments": ["ew", "ory"]},
    )
    correct, grade = grade_objective_response(item, {"segments": ["ew", "wrong"]})
    assert correct is False
    assert grade["correct_count"] == 1
    assert grade["per_gap"] == [True, False]


def test_cefr_for_cut_table():
    assert cefr_for("listening", "easy", 4) == 3
    assert cefr_for("listening", "hard", 4) == 5
    assert cefr_for("listening", "easy", 0) == 1
    # correct count beyond the max key clamps to the max.
    assert cefr_for("reading", "hard", 100) == cefr_for("reading", "hard", 5)
