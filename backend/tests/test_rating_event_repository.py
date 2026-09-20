import pytest

from app.domain.entities import RatingEventCreate, SessionCreate, UserCreate
from app.domain.enums import RaterType, RatingBand, RatingEventStatus, RatingIndicator
from app.infrastructure.repositories import RatingEventRepository, SessionRepository, UserRepository


@pytest.fixture
async def a_session(db_session):
    user_repo = UserRepository(db_session)
    session_repo = SessionRepository(db_session)
    user = await user_repo.create(
        UserCreate(name="Applicant", email="applicant@example.com", password="pw")
    )
    return await session_repo.create(SessionCreate(user_id=user.id, program="CS"))


async def test_create_persists_a_proposed_model_row(db_session, a_session):
    repo = RatingEventRepository(db_session)
    event = await repo.create(
        RatingEventCreate(
            session_id=a_session.id,
            indicator=RatingIndicator.LEADERSHIP.value,
            quote="I led a team of five students.",
            band=RatingBand.STRONG.value,
            rater_type=RaterType.MODEL.value,
        )
    )
    assert event.status == RatingEventStatus.PROPOSED.value
    assert event.rater_id is None

    fetched = await repo.list_by_session(a_session.id)
    assert [e.id for e in fetched] == [event.id]


async def test_list_by_session_only_returns_that_sessions_rows(db_session, a_session):
    other_session = await SessionRepository(db_session).create(
        SessionCreate(user_id=a_session.user_id, program="CS")
    )
    repo = RatingEventRepository(db_session)
    await repo.create(
        RatingEventCreate(
            session_id=a_session.id,
            indicator=RatingIndicator.LEADERSHIP.value,
            quote="quote a",
            band=RatingBand.STRONG.value,
            rater_type=RaterType.MODEL.value,
        )
    )
    await repo.create(
        RatingEventCreate(
            session_id=other_session.id,
            indicator=RatingIndicator.LEADERSHIP.value,
            quote="quote b",
            band=RatingBand.STRONG.value,
            rater_type=RaterType.MODEL.value,
        )
    )
    result = await repo.list_by_session(a_session.id)
    assert len(result) == 1
    assert result[0].quote == "quote a"


async def test_update_status_by_a_human_makes_the_row_a_durable_human_decision(
    db_session, a_session
):
    repo = RatingEventRepository(db_session)
    proposed = await repo.create(
        RatingEventCreate(
            session_id=a_session.id,
            indicator=RatingIndicator.MOTIVATION_UNIVERSITY.value,
            quote="I applied because of the CS program.",
            band=RatingBand.DEVELOPING.value,
            rater_type=RaterType.MODEL.value,
        )
    )
    decided = await repo.update_status(
        proposed.id, status=RatingEventStatus.ACCEPTED.value, rater_id="admin-1"
    )
    assert decided.status == RatingEventStatus.ACCEPTED.value
    assert decided.rater_id == "admin-1"
    assert decided.rater_type == RaterType.HUMAN.value
