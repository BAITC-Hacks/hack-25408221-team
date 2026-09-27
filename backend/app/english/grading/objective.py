"""Module 3: Listening/Reading objective grading. No LLM, no network."""

import re

from app.english.infra.models import Item


def _normalize(text: str) -> str:
    text = text.strip().casefold()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def grade_objective_response(item: Item, answer) -> tuple[bool, dict]:
    key = item.key
    if item.type == "ctest":
        expected = key["segments"]
        given = answer.get("segments", []) if isinstance(answer, dict) else answer
        results = [
            _normalize(str(g)) == _normalize(str(e)) for g, e in zip(given, expected)
        ]
        results += [False] * (len(expected) - len(results))
        correct_count = sum(results)
        return correct_count == len(expected), {"correct_count": correct_count, "total": len(expected), "per_gap": results}

    key_questions = {q["id"]: q for q in key.get("questions", [])}
    given = answer if isinstance(answer, dict) else {}
    per_question = {}
    correct_count = 0
    for qid, q in key_questions.items():
        given_value = given.get(qid)
        is_correct = False
        if "answer" in q:
            is_correct = given_value == q["answer"]
        elif "accept" in q:
            is_correct = given_value is not None and _normalize(str(given_value)) in {
                _normalize(a) for a in q["accept"]
            }
        per_question[qid] = is_correct
        if is_correct:
            correct_count += 1
    return correct_count == len(key_questions), {
        "correct_count": correct_count,
        "total": len(key_questions),
        "per_question": per_question,
    }
