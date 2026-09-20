import json
import logging
from typing import List, Optional, Tuple

from google import genai
from google.genai import types

from app.config import settings
from app.domain.entities import RatingEvent, RatingEventCreate
from app.domain.enums import RaterType, RatingBand, RatingIndicator
from app.domain.interfaces import RatingEventRepositoryInterface, SessionRepositoryInterface

logger = logging.getLogger(__name__)

VALID_INDICATORS = {indicator.value for indicator in RatingIndicator}
VALID_BANDS = {band.value for band in RatingBand}

PROPOSE_RATINGS_PROMPT = """You are an admissions committee assistant proposing rating evidence from a video interview transcript for exactly three indicators: motivation_university, leadership, and prior_experience.

For each indicator, if the transcript contains applicant evidence, propose ONE rating event: a verbatim quote copied exactly from the applicant's own words, and a band describing the strength of that evidence -- "emerging", "developing", or "strong" -- anchored only to what the quote itself demonstrates about that indicator.

Return a JSON object with this exact structure:
{
  "proposals": [
    {"indicator": "motivation_university", "quote": "<verbatim applicant quote>", "band": "emerging|developing|strong"},
    {"indicator": "leadership", "quote": "<verbatim applicant quote>", "band": "emerging|developing|strong"},
    {"indicator": "prior_experience", "quote": "<verbatim applicant quote>", "band": "emerging|developing|strong"}
  ]
}

IMPORTANT:
- Every quote must be copied verbatim from the APPLICANT's own turns, never paraphrased, and never taken from the interviewer's questions.
- Do NOT produce an overall score, an aggregate rating, or a recommendation of any kind -- only these per-indicator quote+band proposals.
- Bands must never be influenced by confidence_level, communication_quality, accent, grammar, vocabulary, fluency, language_used, or family/support situation.
- If the transcript has no usable evidence for an indicator, omit that indicator from "proposals" rather than guessing.

Return ONLY the JSON object, no other text."""


def _applicant_text(transcript: list) -> str:
    """Only the applicant's own turns -- matches explainability.py's
    _extract_key_quotes role filtering, so a quote can never be lifted from
    the interviewer's questions instead of the applicant's answer."""
    return "\n".join(
        entry.get("text", "") for entry in transcript if entry.get("role") == "user"
    )


def validate_proposals(proposals: list, transcript: list) -> List[dict]:
    """Keep only proposals with a recognized indicator/band and a quote that
    is an actual verbatim substring of the applicant's own words. This is
    what makes a persisted rating_event "validated-quote" rather than a
    model assertion taken on faith."""
    applicant_text = _applicant_text(transcript)
    valid: List[dict] = []
    for proposal in proposals:
        indicator = proposal.get("indicator")
        band = proposal.get("band")
        quote = proposal.get("quote", "")

        if indicator not in VALID_INDICATORS:
            logger.warning(f"Discarding rating proposal with unknown indicator: {indicator!r}")
            continue
        if band not in VALID_BANDS:
            logger.warning(f"Discarding rating proposal with unknown band: {band!r}")
            continue
        if not quote or quote not in applicant_text:
            logger.warning(
                f"Discarding rating proposal for indicator {indicator!r}: quote not found verbatim in transcript"
            )
            continue

        valid.append({"indicator": indicator, "band": band, "quote": quote})
    return valid


class ProposeRatingEventsUseCase:
    def __init__(
        self,
        session_repo: SessionRepositoryInterface,
        rating_event_repo: RatingEventRepositoryInterface,
    ):
        self.session_repo = session_repo
        self.rating_event_repo = rating_event_repo

    async def execute(self, session_id: str) -> Tuple[Optional[List[RatingEvent]], Optional[str]]:
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            return None, "Session not found"

        transcript = session.transcript
        if not transcript:
            return None, "No transcript to propose ratings from"

        transcript_text = "\n".join(
            f"[{entry.get('role', 'unknown').upper()}] {entry.get('text', '')}"
            for entry in transcript
        )

        try:
            client = genai.Client(api_key=settings.gemini_api_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    PROPOSE_RATINGS_PROMPT,
                    f"Here is the interview transcript:\n\n{transcript_text}",
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            raw_proposals = json.loads(response.text).get("proposals", [])
        except Exception as e:
            logger.error(
                f"Rating proposal failed for session {session_id}: {e}", exc_info=True
            )
            return None, str(e)

        events = []
        for proposal in validate_proposals(raw_proposals, transcript):
            event = await self.rating_event_repo.create(
                RatingEventCreate(
                    session_id=session_id,
                    indicator=proposal["indicator"],
                    quote=proposal["quote"],
                    band=proposal["band"],
                    rater_type=RaterType.MODEL.value,
                )
            )
            events.append(event)

        logger.info(f"Proposed {len(events)} rating events for session {session_id}")
        return events, None
