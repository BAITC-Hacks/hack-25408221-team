from google import genai
from google.genai import types

from app.config import settings
from app.interview.prompts import SYSTEM_INSTRUCTION, build_end_session_tool


def get_genai_client():
    return genai.Client(
        api_key=settings.gemini_api_key, http_options={"api_version": "v1alpha"}
    )


def build_live_connect_config() -> types.LiveConnectConfig:
    return types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Aoede")
            )
        ),
        system_instruction=SYSTEM_INSTRUCTION,
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
