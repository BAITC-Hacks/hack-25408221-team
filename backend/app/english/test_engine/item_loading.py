"""Splits a raw item-bank JSON record into `content` (safe for the client)
and `key` (server-only: answers, accept lists, transcripts). Never send `key`
to a client-facing endpoint."""

from typing import Any

# Fields that must never reach the client, wherever they appear in an item.
_SERVER_ONLY_TOP = {"transcript"}
_SERVER_ONLY_QUESTION = {"answer", "accept"}


def split_item(raw: dict) -> tuple[dict, dict]:
    section = raw["section"]
    content: dict[str, Any] = {}
    key: dict[str, Any] = {}

    for k, v in raw.items():
        if k in ("id", "section", "type", "stage", "cefr", "status"):
            continue
        if k in _SERVER_ONLY_TOP:
            key[k] = v
            continue
        content[k] = v

    if section == "listening" or (section == "reading" and raw.get("type") == "passage"):
        client_questions = []
        key_questions = []
        for q in raw.get("questions", []):
            client_q = {k: v for k, v in q.items() if k not in _SERVER_ONLY_QUESTION}
            key_q = {k: v for k, v in q.items() if k in _SERVER_ONLY_QUESTION}
            key_q["id"] = q["id"]
            client_questions.append(client_q)
            key_questions.append(key_q)
        content["questions"] = client_questions
        key["questions"] = key_questions

    if section == "reading" and raw.get("type") == "ctest":
        client_segments = []
        key_segments = []
        for seg in raw.get("segments", []):
            if isinstance(seg, dict):
                client_segments.append({"gap": True})
                key_segments.append(seg["answer"])
            else:
                client_segments.append(seg)
        content["segments"] = client_segments
        key["segments"] = key_segments

    return content, key
