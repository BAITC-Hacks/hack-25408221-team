import asyncio
import threading
from typing import Protocol, TypedDict

from app.english.config import english_settings


class Word(TypedDict):
    word: str
    start: float
    end: float
    confidence: float


class Transcript(TypedDict):
    text: str
    words: list[Word]
    duration_s: float


class ASRClient(Protocol):
    async def transcribe(self, audio_path: str) -> Transcript: ...


class FasterWhisperASRClient:
    def __init__(self, model_size: str = "small"):
        self.model_size = model_size
        self._model = None
        self._lock = threading.Lock()

    def _ensure_model(self):
        if self._model is None:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(self.model_size, device="cpu", compute_type="int8", cpu_threads=4)
        return self._model

    async def warm(self) -> None:
        def load():
            with self._lock:
                self._ensure_model()
        await asyncio.to_thread(load)

    async def transcribe(self, audio_path: str) -> Transcript:
        return await asyncio.to_thread(self._locked_transcribe, audio_path)

    def _locked_transcribe(self, audio_path: str) -> Transcript:
        with self._lock:
            return self._transcribe(audio_path)

    def _transcribe(self, audio_path: str) -> Transcript:
        model = self._ensure_model()
        segments, info = model.transcribe(audio_path, word_timestamps=True, language="en", vad_filter=True)
        words: list[Word] = []
        text_parts: list[str] = []
        for seg in segments:
            text_parts.append(seg.text)
            for w in seg.words or []:
                words.append(
                    {
                        "word": w.word.strip(),
                        "start": w.start,
                        "end": w.end,
                        "confidence": getattr(w, "probability", 1.0),
                    }
                )
        return {
            "text": " ".join(text_parts).strip(),
            "words": words,
            "duration_s": info.duration if info else (words[-1]["end"] if words else 0.0),
        }


class FakeASRClient:
    def __init__(self, fixtures: dict[str, Transcript] | None = None, default: Transcript | None = None):
        self.fixtures = fixtures or {}
        self.default = default or {"text": "", "words": [], "duration_s": 0.0}

    async def transcribe(self, audio_path: str) -> Transcript:
        return self.fixtures.get(audio_path, self.default)


_whisper_singleton = None


def get_asr_client() -> ASRClient:
    global _whisper_singleton
    if english_settings.asr_backend == "whisper":
        if _whisper_singleton is None:
            _whisper_singleton = FasterWhisperASRClient(model_size=english_settings.whisper_model)
        return _whisper_singleton
    return FakeASRClient()
