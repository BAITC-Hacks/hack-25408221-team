from app.ml.error_analysis import detect_evaluation_inconsistencies, identify_edge_cases
from app.ml.explainability import explain_recommendation


def test_edge_cases_never_flag_language_or_confidence_or_communication():
    """SPEC Section 1: fluency/accent/language never enter competency
    scoring, and background never enters a score. identify_edge_cases used
    to read applicant_data's language_used/confidence_level/communication_quality
    and feed non_english_interview/low_confidence_assessment/poor_communication
    flags into triage's reliability signal -- those fields are no longer even
    accepted by the function (no applicant_data parameter), so the only edge
    cases it can ever produce are transcript-shape-derived."""
    transcript = [{"role": "user", "text": "hello"}]
    result = identify_edge_cases(transcript)
    types = {e["type"] for e in result["edge_cases"]}
    assert "non_english_interview" not in types
    assert "low_confidence_assessment" not in types
    assert "poor_communication" not in types


def test_inconsistencies_never_flag_communication_quality():
    """Same contract as above for detect_evaluation_inconsistencies -- it
    used to flag a 'communication_score_mismatch' derived from applicant_data's
    communication_quality field. That field is no longer accepted."""
    evaluation = {"overall_score": 3, "recommendation": "recommended"}
    result = detect_evaluation_inconsistencies(evaluation)
    types = {i["type"] for i in result["inconsistencies"]}
    assert "communication_score_mismatch" not in types


def test_explain_recommendation_never_cites_communication_quality():
    """explain_recommendation used to add a 'Communication quality:
    excellent/good/poor' factor to the reasons shown to reviewers -- a
    fluency-adjacent signal presented as a reason for the recommendation.
    applicant_data is no longer even accepted by the function."""
    evaluation = {
        "overall_score": 7,
        "recommendation": "recommended",
        "strengths": ["Clear goals"],
        "concerns": [],
    }
    result = explain_recommendation(evaluation, None)
    factor_texts = [f["factor"] for f in result["factors"]]
    assert not any("Communication quality" in text for text in factor_texts)
