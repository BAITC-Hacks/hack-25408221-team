"""Scripted fake for the google-genai Live API surface used by app/api/websocket.py.

Duck-types the pieces the app touches (response.server_content.*,
response.tool_call.function_calls, session.send_realtime_input/receive/send_tool_response,
client.aio.live.connect) so tests can script a conversation without a network call.
"""

from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, List, Optional


@dataclass
class FakeTranscription:
    text: Optional[str] = None


@dataclass
class FakeInlineData:
    data: bytes


@dataclass
class FakePart:
    inline_data: Optional[FakeInlineData] = None
    text: Optional[str] = None


@dataclass
class FakeModelTurn:
    parts: List[FakePart] = field(default_factory=list)


@dataclass
class FakeServerContent:
    input_transcription: Optional[FakeTranscription] = None
    output_transcription: Optional[FakeTranscription] = None
    model_turn: Optional[FakeModelTurn] = None
    interrupted: bool = False
    turn_complete: bool = False


@dataclass
class FakeFunctionCall:
    name: str
    args: dict
    id: str = "call-1"


@dataclass
class FakeToolCall:
    function_calls: List[FakeFunctionCall] = field(default_factory=list)


@dataclass
class FakeLiveResponse:
    server_content: Optional[FakeServerContent] = None
    tool_call: Optional[FakeToolCall] = None


def user_transcript(text: str) -> FakeLiveResponse:
    return FakeLiveResponse(server_content=FakeServerContent(input_transcription=FakeTranscription(text=text)))


def assistant_transcript(text: str) -> FakeLiveResponse:
    return FakeLiveResponse(server_content=FakeServerContent(output_transcription=FakeTranscription(text=text)))


def end_session_call(args: dict, call_id: str = "call-1") -> FakeLiveResponse:
    return FakeLiveResponse(
        tool_call=FakeToolCall(function_calls=[FakeFunctionCall(name="end_session", args=args, id=call_id)])
    )


class FakeLiveSession:
    """Records what the app sends and replays a scripted list of responses on receive()."""

    def __init__(self, responses: Optional[List[FakeLiveResponse]] = None):
        self._responses = list(responses or [])
        self.sent_audio: List[bytes] = []
        self.tool_responses: List[Any] = []
        self.closed = False

    def queue(self, response: FakeLiveResponse) -> None:
        self._responses.append(response)

    async def send_realtime_input(self, audio):
        self.sent_audio.append(audio.data if hasattr(audio, "data") else audio)

    async def receive(self):
        for response in self._responses:
            yield response

    async def send_tool_response(self, function_responses):
        self.tool_responses.append(function_responses)


class FakeLiveConnect:
    def __init__(self, session: FakeLiveSession):
        self._session = session

    async def __aenter__(self) -> FakeLiveSession:
        return self._session

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        self._session.closed = True
        return False


def make_fake_genai_client(session: FakeLiveSession):
    """Returns an object shaped like genai.Client(...) with .aio.live.connect(...)."""

    def connect(**kwargs):
        return FakeLiveConnect(session)

    return SimpleNamespace(aio=SimpleNamespace(live=SimpleNamespace(connect=connect)))
