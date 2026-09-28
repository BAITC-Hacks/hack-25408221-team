"""Cheap feature extraction used as sanity checks alongside the LLM grade."""

import re


def word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z']+", text))


def mattr(text: str, window: int = 50) -> float:
    words = re.findall(r"[A-Za-z']+", text.lower())
    if len(words) < window:
        return len(set(words)) / len(words) if words else 0.0
    ratios = []
    for i in range(len(words) - window + 1):
        chunk = words[i : i + window]
        ratios.append(len(set(chunk)) / window)
    return sum(ratios) / len(ratios)


def speech_rate_wpm(word_count_: int, duration_s: float) -> float:
    if duration_s <= 0:
        return 0.0
    return word_count_ / (duration_s / 60)


def pause_ratio(words: list[dict], duration_s: float) -> float:
    if duration_s <= 0 or not words:
        return 0.0
    silence = 0.0
    prev_end = 0.0
    for w in words:
        gap = w["start"] - prev_end
        if gap > 0.25:
            silence += gap
        prev_end = w["end"]
    return min(silence / duration_s, 1.0)


def long_pause_count(words: list[dict]) -> int:
    count = 0
    prev_end = 0.0
    for w in words:
        if w["start"] - prev_end > 1.0:
            count += 1
        prev_end = w["end"]
    return count


def onset_s(words: list[dict]) -> float:
    return words[0]["start"] if words else 0.0
