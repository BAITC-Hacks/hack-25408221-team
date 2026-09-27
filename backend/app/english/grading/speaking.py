"""Module 3: Speaking grading."""

from pathlib import Path

from app.english.grading.features import long_pause_count, onset_s, pause_ratio, speech_rate_wpm, word_count
from app.english.grading.llm_rubric import grade_with_rubric
from app.english.infra.asr import ASRClient
from app.english.infra.llm import LLMClient

_PROMPT_PATH = Path(__file__).parent / "prompts" / "speaking_rubric.md"
CRITERIA = ["fluency", "range", "accuracy", "coherence", "task_fulfilment"]


async def grade_speaking(
    answers: list[dict],
    asr: ASRClient,
    llm: LLMClient,
) -> dict:
    per_task = {}
    transcript_parts = []
    task_flags: list[str] = []

    for a in answers:
        t = await asr.transcribe(a["audio_path"])
        wc = word_count(t["text"])
        if wc < 10:
            task_flags.append(f"no_response:{a['task']}")
        per_task[a["task"]] = {
            "transcript": t["text"],
            "word_count": wc,
            "speech_rate_wpm": round(speech_rate_wpm(wc, t["duration_s"]), 1),
            "pause_ratio": round(pause_ratio(t["words"], t["duration_s"]), 3),
            "long_pauses": long_pause_count(t["words"]),
            "onset_s": round(onset_s(t["words"]), 2),
        }
        transcript_parts.append(f"[{a['task']}] {a['prompt']}\nAnswer: {t['text']}")

    full_transcript = "\n\n".join(transcript_parts)
    system = _PROMPT_PATH.read_text()
    features_summary = "\n".join(
        f"{task}: {d['word_count']} words, {d['speech_rate_wpm']} wpm, "
        f"pause ratio {d['pause_ratio']}, {d['long_pauses']} long pauses, onset {d['onset_s']}s"
        for task, d in per_task.items()
    )
    user = f"{full_transcript}\n\nFeatures:\n{features_summary}"

    grade = await grade_with_rubric(llm, system, user, CRITERIA, "\n".join(d["transcript"] for d in per_task.values()))

    level = grade.skill_level
    flags = list(task_flags)
    if grade.invalid_runs:
        flags.append("partial_grading")
    if grade.any_disagreement:
        flags.append("grader_disagreement")
    if grade.invalid_runs >= len(grade.criteria) or not any(c.levels for c in grade.criteria.values()):
        flags.append("grade_invalid")

    return {
        "level": level,
        "criteria": {
            name: {"median": c.median, "levels": c.levels, "evidence": c.evidence}
            for name, c in grade.criteria.items()
        },
        "per_task": per_task,
        "flags": flags,
        "rationale": grade.rationale,
    }
