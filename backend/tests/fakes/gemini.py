"""Scripted fake for the google-genai Live API surface used by app/api/websocket.py.

Duck-types the pieces the app touches (response.server_content.*,
response.tool_call.function_calls, session.send_realtime_input/receive/send_tool_response,
client.aio.live.connect) so tests can script a conversation without a network call.
"""

import asyncio
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, List, Optional, Union


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

    def __init__(
        self,
        responses: Optional[List[FakeLiveResponse]] = None,
        hang_when_exhausted: bool = False,
        initial_delay: float = 0.0,
    ):
        self._responses = list(responses or [])
        self.sent_audio: List[bytes] = []
        self.tool_responses: List[Any] = []
        self.closed = False
        # When True, receive() suspends forever (like the real Live API waiting
        # on the next server message) once the scripted responses run out,
        # instead of ending the generator. Needed for tests that keep a
        # connection open without ever calling end_session.
        self._hang_when_exhausted = hang_when_exhausted
        # Real (async) delay before the first response is yielded -- lets a
        # test simulate a scripted response arriving some measurable time
        # after the connection opens, e.g. to assert something that happens
        # in between (like a B5 recalibration message) took effect first.
        self._initial_delay = initial_delay

    def queue(self, response: FakeLiveResponse) -> None:
        self._responses.append(response)

    async def send_realtime_input(self, audio):
        self.sent_audio.append(audio.data if hasattr(audio, "data") else audio)

    async def receive(self):
        if self._initial_delay:
            await asyncio.sleep(self._initial_delay)
        for response in self._responses:
            yield response
        if self._hang_when_exhausted:
            await asyncio.Event().wait()

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


def make_fake_genai_client(session_or_sessions: Union[FakeLiveSession, List[FakeLiveSession]]):
    """Returns an object shaped like genai.Client(...) with .aio.live.connect(...).

    Pass a single FakeLiveSession to have every connect() call return it (the
    original behavior, used by most tests). Pass a list to hand back a
    distinct session on each successive connect() call -- needed for B10
    reconnect tests, where the second connection must be a genuinely fresh
    Gemini Live session, not a replay of the first one's exhausted responses.
    The last list entry is reused if connect() is called more times than the
    list has sessions. Every call's kwargs (model, config, ...) are recorded
    on the returned client's `connect_calls` for assertions."""
    sessions = (
        session_or_sessions
        if isinstance(session_or_sessions, list)
        else [session_or_sessions]
    )
    connect_calls: List[dict] = []

    def connect(**kwargs):
        connect_calls.append(kwargs)
        index = min(len(connect_calls) - 1, len(sessions) - 1)
        return FakeLiveConnect(sessions[index])

    client = SimpleNamespace(aio=SimpleNamespace(live=SimpleNamespace(connect=connect)))
    client.connect_calls = connect_calls
    return client
