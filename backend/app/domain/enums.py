from enum import Enum


class SessionStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    INCOMPLETE = "incomplete"


class Recommendation(str, Enum):
    STRONGLY_RECOMMENDED = "strongly_recommended"
    RECOMMENDED = "recommended"
    NEEDS_REVIEW = "needs_review"
    NOT_RECOMMENDED = "not_recommended"


class RatingIndicator(str, Enum):
    """The 3 scoring-core blocks in scope for this pass (SPEC cut line) --
    each is a named, rubric-anchored indicator a rating_event can attach to.
    Never an aggregate/overall score."""

    MOTIVATION_UNIVERSITY = "motivation_university"
    LEADERSHIP = "leadership"
    PRIOR_EXPERIENCE = "prior_experience"


class RatingBand(str, Enum):
    """A fixed, rubric-anchored 3-level ordinal (SPEC Section 1: never a
    computed threshold or per-rater z-score)."""

    EMERGING = "emerging"
    DEVELOPING = "developing"
    STRONG = "strong"


class RaterType(str, Enum):
    MODEL = "model"
    HUMAN = "human"


class RatingEventStatus(str, Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
