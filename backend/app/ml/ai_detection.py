import logging
from typing import Any, Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)

SAPLING_DETECT_URL = "https://api.sapling.ai/api/v1/aidetect"
AI_FLAG_THRESHOLD = 0.5  # sentence score above this is considered AI-generated


def _build_user_text(
    transcript: List[Dict[str, Any]],
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Concatenate user-only transcript entries into a single space-joined string,
    tracking the exact character range of each entry so we can map Sapling
    sentence scores back to original timestamps.

    Also computes timestamp_start for each user entry by looking at the previous
    transcript entry (regardless of role), so we get a proper speaking range.

    Returns:
        combined_text: full string sent to Sapling
        entry_map: list of {start, end, timestamp_start, timestamp_end, transcript_index, text}
                   where [start, end) are half-open char offsets into combined_text
    """
    parts: List[str] = []
    entry_map: List[Dict[str, Any]] = []
    offset = 0
    prev_timestamp = 0.0

    for idx, entry in enumerate(transcript):
        ts = entry.get("timestamp", 0.0) or 0.0
        if entry.get("role") != "user":
            prev_timestamp = ts
            continue
        text = entry.get("text", "").strip()
        if not text:
            prev_timestamp = ts
            continue

        start = offset
        end = offset + len(text)
        entry_map.append(
            {
                "start": start,
                "end": end,
                "timestamp_start": prev_timestamp,
                "timestamp_end": ts,
                "transcript_index": idx,
                "text": text,
            }
        )
        parts.append(text)
        offset = end + 1  # +1 for the " " separator
        prev_timestamp = ts

    combined_text = " ".join(parts)
    return combined_text, entry_map


def _find_entries_for_sentence(
    sentence: str,
    combined_text: str,
    entry_map: List[Dict[str, Any]],
    search_from: int = 0,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Locate `sentence` inside `combined_text` starting at `search_from`, then
    return every entry_map entry whose character range overlaps the sentence.
    """
    pos = combined_text.find(sentence, search_from)
    if pos == -1:
        return [], -1

    sentence_start = pos
    sentence_end = pos + len(sentence)

    overlapping = [
        entry for entry in entry_map
        if entry["start"] < sentence_end and entry["end"] > sentence_start
    ]

    return overlapping, pos


def run_ai_detection(
    transcript: List[Dict[str, Any]],
    api_key: str,
) -> Dict[str, Any]:
    """
    Run Sapling AI detection on all user speech from the transcript.

    Returns a dict with:
        overall_score      : float (0=human, 1=AI) — document-level score
        flagged_segments   : list of transcript entries that contain AI-flagged sentences, each with:
                               transcript_index, text,
                               timestamp_start (start of speaking window),
                               timestamp_end   (end of speaking window),
                               max_ai_score    (highest sentence score in this entry),
                               sentences       (list of {sentence, ai_score} for flagged sentences)
        total_user_segments: int — number of user transcript entries analyzed
        error              : str | None
    """
    if not api_key:
        return {"error": "SAPLING_API_KEY not configured", "flagged_segments": [], "overall_score": None}

    combined_text, entry_map = _build_user_text(transcript)

    if not combined_text:
        return {"error": "No user speech found in transcript", "flagged_segments": [], "overall_score": None}

    try:
        response = requests.post(
            SAPLING_DETECT_URL,
            json={"key": api_key, "text": combined_text, "sent_scores": True},
            timeout=30,
        )
        response.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"Sapling AI detection request failed: {e}")
        return {"error": str(e), "flagged_segments": [], "overall_score": None}

    data = response.json()
    overall_score: float = data.get("score", 0.0)
    sentence_scores: List[Dict[str, Any]] = data.get("sentence_scores", [])

    # Group flagged sentences by transcript entry index
    # key: transcript_index -> {entry metadata + list of flagged sentences}
    flagged_by_entry: Dict[int, Dict[str, Any]] = {}
    search_from = 0

    for ss in sentence_scores:
        score = ss.get("score", 0.0)
        sentence_text = ss.get("sentence", "")

        overlapping, found_at = _find_entries_for_sentence(
            sentence_text, combined_text, entry_map, search_from
        )

        if found_at != -1:
            search_from = found_at + len(sentence_text)

        if score < AI_FLAG_THRESHOLD:
            continue

        for entry in overlapping:
            tidx = entry["transcript_index"]
            if tidx not in flagged_by_entry:
                flagged_by_entry[tidx] = {
                    "transcript_index": tidx,
                    "text": entry["text"],
                    "timestamp_start": entry["timestamp_start"],
                    "timestamp_end": entry["timestamp_end"],
                    "max_ai_score": 0.0,
                    "sentences": [],
                }
            flagged_by_entry[tidx]["sentences"].append(
                {"sentence": sentence_text, "ai_score": round(score, 4)}
            )
            flagged_by_entry[tidx]["max_ai_score"] = round(
                max(flagged_by_entry[tidx]["max_ai_score"], score), 4
            )

    # Return sorted by transcript order
    flagged_segments = sorted(flagged_by_entry.values(), key=lambda x: x["transcript_index"])

    return {
        "overall_score": round(overall_score, 4),
        "flagged_segments": flagged_segments,
        "total_user_segments": len(entry_map),
        "error": None,
    }
