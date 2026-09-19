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
