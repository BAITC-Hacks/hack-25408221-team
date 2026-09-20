import pytest

from app.domain.entities import SessionCreate, UserCreate
from app.domain.enums import RaterType, RatingEventStatus
from app.infrastructure.repositories import (
    RatingEventRepository,
    SessionRepository,
    UserRepository,
)
from app.use_cases.propose_rating_events_use_case import validate_proposals

TRANSCRIPT = [
    {"role": "assistant", "text": "Why do you want to study leadership here?"},
    {"role": "user", "text": "I led a team of five students to rebuild our school's robotics club."},
    {"role": "user", "text": "I chose this university because of its research in renewable energy."},
]


@pytest.fixture
async def a_session(db_session):
    user_repo = UserRepository(db_session)
    session_repo = SessionRepository(db_session)
    user = await user_repo.create(
        UserCreate(name="Applicant", email="applicant@example.com", password="pw")
    )
    return await session_repo.create(SessionCreate(user_id=user.id, program="CS"))


def test_validate_proposals_keeps_a_verbatim_applicant_quote():
    proposals = [
        {
            "indicator": "leadership",
            "quote": "I led a team of five students to rebuild our school's robotics club.",
            "band": "strong",
        }
    ]
    valid = validate_proposals(proposals, TRANSCRIPT)
    assert len(valid) == 1
    assert valid[0]["indicator"] == "leadership"


def test_validate_proposals_discards_a_quote_not_found_in_the_transcript():
    proposals = [{"indicator": "leadership", "quote": "I was captain of the debate team.", "band": "strong"}]
    assert validate_proposals(proposals, TRANSCRIPT) == []


def test_validate_proposals_discards_a_quote_lifted_from_the_interviewer_not_the_applicant():
    proposals = [
        {"indicator": "leadership", "quote": "Why do you want to study leadership here?", "band": "strong"}
    ]
    assert validate_proposals(proposals, TRANSCRIPT) == []


def test_validate_proposals_discards_an_unknown_indicator():
    proposals = [
        {
            "indicator": "communication_style",
            "quote": "I led a team of five students to rebuild our school's robotics club.",
            "band": "strong",
        }
    ]
    assert validate_proposals(proposals, TRANSCRIPT) == []


def test_validate_proposals_discards_an_unknown_band():
    proposals = [
        {
            "indicator": "leadership",
            "quote": "I led a team of five students to rebuild our school's robotics club.",
            "band": "exceptional",
        }
    ]
    assert validate_proposals(proposals, TRANSCRIPT) == []


async def test_execute_persists_only_validated_proposals_as_proposed_model_rows(
    db_session, a_session, monkeypatch
):
    from app.use_cases import propose_rating_events_use_case as module

    await SessionRepository(db_session).update_transcript(a_session.id, TRANSCRIPT)

    class FakeResponse:
        text = (
            '{"proposals": ['
            '{"indicator": "leadership", "quote": '
            '"I led a team of five students to rebuild our school\'s robotics club.", '
            '"band": "strong"}, '
            '{"indicator": "motivation_university", "quote": "made up quote", "band": "strong"}'
            "]}"
        )

    class FakeModels:
        def generate_content(self, **kwargs):
            return FakeResponse()

    class FakeClient:
        def __init__(self, **kwargs):
            self.models = FakeModels()

    monkeypatch.setattr(module.genai, "Client", FakeClient)

    use_case = module.ProposeRatingEventsUseCase(
        SessionRepository(db_session), RatingEventRepository(db_session)
    )
    events, error = await use_case.execute(a_session.id)

    assert error is None
    assert len(events) == 1
    assert events[0].indicator == "leadership"
    assert events[0].status == RatingEventStatus.PROPOSED.value
    assert events[0].rater_type == RaterType.MODEL.value
    assert events[0].rater_id is None

    for field in ("overall_score", "score", "recommendation", "verdict"):
        assert not hasattr(events[0], field)
