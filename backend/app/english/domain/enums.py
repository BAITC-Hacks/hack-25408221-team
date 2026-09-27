from enum import Enum, IntEnum


class CEFR(IntEnum):
    A1 = 1
    A2 = 2
    B1 = 3
    B2 = 4
    C1 = 5
    C2 = 6


class ApplicantState(str, Enum):
    NEW = "new"
    IELTS_PENDING = "ielts_pending"
    NEEDS_TEST = "needs_test"
    TESTING = "testing"
    PLACED = "placed"
    NEEDS_REVIEW = "needs_review"


class Placement(str, Enum):
    BACHELOR = "BACHELOR"
    FOUNDATION = "FOUNDATION"


class PlacementSource(str, Enum):
    IELTS = "ielts"
    TEST = "test"
    HUMAN = "human"


class IeltsVerdict(str, Enum):
    VERIFIED = "VERIFIED"
    EXPIRED = "EXPIRED"
    NOT_VERIFIED = "NOT_VERIFIED"
    PENDING = "PENDING"


class IeltsModule(str, Enum):
    ACADEMIC = "academic"
    GENERAL = "general"


class Section(str, Enum):
    LISTENING = "listening"
    READING = "reading"
    WRITING = "writing"
    SPEAKING = "speaking"


class Stage(str, Enum):
    ROUTING = "routing"
    EASY = "easy"
    HARD = "hard"
    SINGLE = "single"


class ItemStatus(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"


class SessionState(str, Enum):
    CREATED = "created"
    CHECKIN = "checkin"
    LISTENING = "listening"
    READING = "reading"
    WRITING = "writing"
    SPEAKING = "speaking"
    GRADING = "grading"
    DECIDED = "decided"
    NEEDS_REVIEW = "needs_review"


SECTION_ORDER = [Section.LISTENING, Section.READING, Section.WRITING, Section.SPEAKING]


class IntegrityLevel(str, Enum):
    GREEN = "green"
    AMBER = "amber"
    RED = "red"


class ReviewDecision(str, Enum):
    BACHELOR = "BACHELOR"
    FOUNDATION = "FOUNDATION"
    RETAKE = "retake"
