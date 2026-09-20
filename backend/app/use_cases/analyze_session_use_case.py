import json
import logging
from typing import Any, Dict, Optional, Tuple

from google import genai
from google.genai import types

from app.config import settings
from app.domain.interfaces import SessionRepositoryInterface

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT = """You are an admissions evaluator analyzing a video interview transcript. Analyze the following conversation and extract structured data.

Return a JSON object with this exact structure:
{
  "applicant_data": {
    "q1_why_applying": "extracted answer to why applying",
    "q2_program_choice": "extracted answer about program choice",
    "q3_challenge_overcome": "extracted answer about challenge",
    "q4_long_term_goals": "extracted answer about goals",
    "q5_leadership": "extracted answer about leadership",
    "q6_family_support": "extracted answer about family support",
    "language_used": "primary language detected",
    "confidence_level": "high/medium/low",
    "communication_quality": "excellent/good/average/poor"
  },
  "evaluation": {
    "overall_score": 1-10,
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "areas_for_improvement": ["area 1", "area 2"],
    "recommendation": "strongly_recommended/recommended/needs_review/not_recommended",
    "notes": "brief summary of overall impression"
  }
}

IMPORTANT — overall_score, recommendation, strengths, and areas_for_improvement must never
be influenced by confidence_level, communication_quality, accent, grammar, vocabulary,
fluency, language_used, or the content of q6_family_support. Those fields are recorded for
the admissions committee's context only, not as scoring inputs.

Return ONLY the JSON object, no other text."""


class AnalyzeSessionUseCase:
    def __init__(self, session_repo: SessionRepositoryInterface):
        self.session_repo = session_repo

    async def execute(
        self, session_id: str, transcript: list
    ) -> Tuple[Optional[dict], Optional[str]]:
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            return None, "Session not found"

        if not transcript:
            return None, "No transcript to analyze"

        transcript_text = "\n".join(
            f"[{entry.get('role', 'unknown').upper()}] {entry.get('text', '')}"
            for entry in transcript
        )

        try:
            client = genai.Client(api_key=settings.gemini_api_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    ANALYSIS_PROMPT,
                    f"Here is the interview transcript:\n\n{transcript_text}",
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )

            analysis = json.loads(response.text)

            applicant_data = analysis.get("applicant_data", {})
            evaluation = analysis.get("evaluation", {})

            await self.session_repo.update_transcript(session_id, transcript)
            await self.session_repo.update_applicant_data(session_id, applicant_data)
            await self.session_repo.update_evaluation(session_id, evaluation)

            logger.info(f"Session {session_id} analyzed successfully")
            return {"applicant_data": applicant_data, "evaluation": evaluation}, None

        except Exception as e:
            logger.error(
                f"Analysis failed for session {session_id}: {e}", exc_info=True
            )
            await self.session_repo.update_transcript(session_id, transcript)
            return None, str(e)
