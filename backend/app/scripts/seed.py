"""One-command demo seed: an admin account, a handful of applicants with
completed sessions + realistic transcripts, and model-proposed rating_events
for each (via ProposeRatingEventsUseCase) so the committee grid
(GET /api/admin/committee) has real rows to demo against.

Usage: python -m app.scripts.seed
"""
import asyncio
import logging

from app.domain.entities import SessionCreate, UserCreate
from app.infrastructure.database import get_session, init_db
from app.infrastructure.repositories import RatingEventRepository, SessionRepository, UserRepository
from app.use_cases.propose_rating_events_use_case import ProposeRatingEventsUseCase

logger = logging.getLogger(__name__)

SEED_ADMIN = {
    "name": "Admissions Admin",
    "email": "admin@invision.demo",
    "password": "demo-admin-password",
}

SEED_APPLICANTS = [
    {
        "name": "Ada Lovelace",
        "email": "ada@invision.demo",
        "program": "Computer Science",
        "transcript": [
            {"role": "assistant", "text": "Why do you want to study computer science with us?"},
            {
                "role": "user",
                "text": "I've been building small compilers since high school and I want to work with "
                "your faculty on programming language theory.",
            },
            {"role": "assistant", "text": "Tell me about a time you led a team."},
            {
                "role": "user",
                "text": "I led a team of five students to rebuild our school's robotics club from scratch.",
            },
            {"role": "assistant", "text": "What relevant experience do you bring?"},
            {
                "role": "user",
                "text": "I interned for a summer at a startup building embedded firmware for drones.",
            },
        ],
    },
    {
        "name": "Grace Hopper",
        "email": "grace@invision.demo",
        "program": "Applied Mathematics",
        "transcript": [
            {"role": "assistant", "text": "Why this program?"},
            {
                "role": "user",
                "text": "I want to study applied mathematics because I care about making computing "
                "accessible to people who aren't programmers.",
            },
            {"role": "assistant", "text": "Tell me about a leadership moment."},
            {
                "role": "user",
                "text": "I organized a weekend workshop that taught forty classmates their first "
                "programming language.",
            },
            {"role": "assistant", "text": "Any relevant prior experience?"},
            {
                "role": "user",
                "text": "I spent two summers as a teaching assistant for an introductory statistics course.",
            },
        ],
    },
    {
        "name": "Alan Turing",
        "email": "alan@invision.demo",
        "program": "Computer Science",
        "transcript": [
            {"role": "assistant", "text": "What draws you to this program?"},
            {
                "role": "user",
                "text": "I want to study the limits of computation and this program has the strongest "
                "theory faculty I could find.",
            },
            {"role": "assistant", "text": "Describe a time you led others."},
            {
                "role": "user",
                "text": "I led a small research reading group that met weekly for a full year.",
            },
            {"role": "assistant", "text": "What experience have you had in this field?"},
            {
                "role": "user",
                "text": "I built a small automated proof checker as an independent project last year.",
            },
        ],
    },
]


async def seed(
    user_repo: UserRepository,
    session_repo: SessionRepository,
    rating_event_repo: RatingEventRepository,
) -> dict:
    """Idempotent: skips any user (admin or applicant) whose email already
    exists, so re-running against an already-seeded DB creates nothing new."""
    created_users = 0
    created_sessions = 0
    proposed_events = 0

    admin = await user_repo.get_by_email(SEED_ADMIN["email"])
    if not admin:
        await user_repo.create(UserCreate(**SEED_ADMIN, role="admin"))
        created_users += 1

    propose_use_case = ProposeRatingEventsUseCase(session_repo, rating_event_repo)

    for applicant in SEED_APPLICANTS:
        existing = await user_repo.get_by_email(applicant["email"])
        if existing:
            continue

        user = await user_repo.create(
            UserCreate(name=applicant["name"], email=applicant["email"], password="demo-applicant-password")
        )
        created_users += 1

        session = await session_repo.create(SessionCreate(user_id=user.id, program=applicant["program"]))
        await session_repo.update_transcript(session.id, applicant["transcript"])
        created_sessions += 1

        events, error = await propose_use_case.execute(session.id)
        if error:
            logger.warning(f"Skipping rating proposals for {applicant['email']}: {error}")
        else:
            proposed_events += len(events)

    return {
        "admin_email": SEED_ADMIN["email"],
        "created_users": created_users,
        "created_sessions": created_sessions,
        "proposed_events": proposed_events,
    }


async def run() -> dict:
    await init_db()
    session_gen = get_session()
    db_session = await session_gen.__anext__()
    try:
        return await seed(
            UserRepository(db_session),
            SessionRepository(db_session),
            RatingEventRepository(db_session),
        )
    finally:
        await session_gen.aclose()


if __name__ == "__main__":
    summary = asyncio.run(run())
    print(f"Seed complete: {summary}")
