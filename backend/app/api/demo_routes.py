
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.ml.baseline import baseline_score_applicant
from app.ml.explainability import compute_feature_importance, explain_recommendation
from app.ml.scorer import CoreScorer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/demo", tags=["demo"])

SAMPLE_TRANSCRIPT = [
    {
        "role": "assistant",
        "text": "Welcome to inVision University! I'm here to guide you through your video presentation. Let's start — why are you applying to inVision U?",
    },
    {
        "role": "user",
        "text": "I'm applying because I believe inVision U offers the best environment for me to grow as a professional. I'm passionate about technology and entrepreneurship, and your programs align perfectly with my career goals.",
    },
    {
        "role": "assistant",
        "text": "That's wonderful motivation! Which program are you applying to, and why did you choose it?",
    },
    {
        "role": "user",
        "text": "I'm applying for the Undergraduate Computer Science program. I chose it because I want to build software that solves real-world problems, and I believe a strong CS foundation is essential for that.",
    },
]

SAMPLE_APPLICANT_DATA = {
    "q1_why_applying": "I'm applying because inVision U aligns with my passion for technology and entrepreneurship.",
    "q2_program_choice": "Computer Science undergraduate — strong foundation for building impactful software.",
    "q3_challenge_overcome": "I overcame financial hardship during high school by working part-time while maintaining top grades.",
    "q4_long_term_goals": "I aim to found a tech startup addressing education accessibility in Central Asia.",
    "q5_leadership": "I led a team of 5 students to build a school management app that was adopted by 3 schools.",
    "q6_family_support": "My parents are fully supportive — my mother is a teacher and understands the value of education.",
    "language_used": "english",
    "confidence_level": "high",
    "communication_quality": "excellent",
}

SAMPLE_EVALUATION = {
    "overall_score": 8.5,
    "strengths": ["Clear motivation", "Strong leadership example", "Articulate communication"],
    "concerns": [],
    "recommendation": "recommended",
    "overall_impression": "Strong candidate with clear goals and demonstrated leadership.",
}


@router.post("/analyze")
async def demo_analyze(
    payload: Dict[str, Any],
    current_user=Depends(get_current_user),
):
    applicant_data = payload.get("applicant_data") or SAMPLE_APPLICANT_DATA
    evaluation = payload.get("evaluation") or SAMPLE_EVALUATION
    transcript: Optional[List[dict]] = payload.get("transcript") or SAMPLE_TRANSCRIPT

    scores = CoreScorer().score_core(applicant_data, transcript, evaluation)
    baseline = scores["baseline"]

    explanation = explain_recommendation(evaluation, applicant_data, baseline)
    feature_importance = compute_feature_importance(applicant_data, evaluation)

    return {
        "note": "Demo analysis — results are not persisted",
        "used_sample_data": not bool(payload.get("applicant_data")),
        "data_quality": scores["data_quality"],
        "baseline_evaluation": baseline,
        "agreement": scores["agreement"],
        "error_analysis": {
            "inconsistencies": scores["inconsistencies"],
            "edge_cases": scores["edge_cases"],
        },
        "explainability": {
            "explanation": explanation,
            "feature_importance": feature_importance,
        },
        "authenticity": scores["authenticity"],
    }


@router.get("/baseline")
async def demo_baseline(
    current_user=Depends(get_current_user),
):
    return {
        "note": "Baseline evaluation of built-in sample applicant data",
        "sample_applicant_data": SAMPLE_APPLICANT_DATA,
        "baseline_result": baseline_score_applicant(SAMPLE_APPLICANT_DATA),
    }
