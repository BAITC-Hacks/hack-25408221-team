import contextlib
import logging
from typing import Optional

from google import genai
from google.genai import types
import google.genai.live as genai_live

from app.config import settings
from app.interview.prompts import build_end_session_tool, build_system_instruction

logger = logging.getLogger(__name__)

_real_ws_connect = genai_live.ws_connect
_patched = False


def patch_genai_live(proxy_url: str) -> None:
    global _patched
    if _patched:
        return
    try:
        from python_socks.async_.asyncio import Proxy
    except ImportError:
        logger.warning("python-socks not installed; cannot apply Gemini Live proxy")
        return

    @contextlib.asynccontextmanager
    async def proxied_connect(uri: str, **kwargs):
        proxy = Proxy.from_url(proxy_url)
        sock = await proxy.connect(dest_host="generativelanguage.googleapis.com", dest_port=443)
        kwargs["sock"] = sock
        async with _real_ws_connect(uri, **kwargs) as ws:
            yield ws

    genai_live.ws_connect = proxied_connect
    _patched = True
    logger.info(f"Gemini Live successfully routed via proxy {proxy_url}")


def get_genai_client():
    if settings.gemini_proxy_url:
        patch_genai_live(settings.gemini_proxy_url)
    return genai.Client(
        api_key=settings.gemini_api_key, http_options={"api_version": "v1alpha"}
    )


def build_live_connect_config(
    resume_context: Optional[str] = None,
) -> types.LiveConnectConfig:
    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Aoede")
            )
        ),
        system_instruction=build_system_instruction(
            settings.max_interview_duration, resume_context
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=False,
                silence_duration_ms=1000,
                start_of_speech_sensitivity="START_SENSITIVITY_HIGH",
                end_of_speech_sensitivity="END_SENSITIVITY_HIGH",
            )
        ),
        proactivity=types.ProactivityConfig(),
        tools=[build_end_session_tool()],
    )
