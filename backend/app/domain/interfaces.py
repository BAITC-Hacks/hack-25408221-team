from abc import ABC, abstractmethod
from typing import List, Optional

from app.domain.entities import Session, SessionCreate, User, UserCreate


class UserRepositoryInterface(ABC):
    @abstractmethod
    async def create(self, user: UserCreate) -> User:
        pass

    @abstractmethod
    async def get_by_id(self, user_id: str) -> Optional[User]:
        pass

    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[User]:
        pass

    @abstractmethod
    async def list_all(self) -> List[User]:
        pass


class SessionRepositoryInterface(ABC):
    @abstractmethod
    async def create(self, session: SessionCreate) -> Session:
        pass

    @abstractmethod
    async def get_by_id(self, session_id: str) -> Optional[Session]:
        pass

    @abstractmethod
    async def get_by_user_id(self, user_id: str) -> Optional[Session]:
        pass

    @abstractmethod
    async def list_all(self) -> List[Session]:
        pass

    @abstractmethod
    async def update_recording(self, session_id: str, recording_url: str) -> Session:
        pass

    @abstractmethod
    async def update_transcript(self, session_id: str, transcript: list) -> Session:
        pass

    @abstractmethod
    async def update_applicant_data(
        self, session_id: str, applicant_data: dict
    ) -> Session:
        pass

    @abstractmethod
    async def update_evaluation(self, session_id: str, evaluation: dict) -> Session:
        pass

    @abstractmethod
    async def complete(self, session_id: str) -> Session:
        pass

    @abstractmethod
    async def mark_incomplete(self, session_id: str) -> Session:
        pass
