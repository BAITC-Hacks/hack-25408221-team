# NOTES

Running log for the repo-prep / live-call-stabilization sprint. One entry per task from
PART C of the spec. "Skipped" entries explain why; "Remaining" is filled in at the end.

## Done

### A1 — Backend test safety net
- Added `backend/tests/` with pytest + pytest-asyncio + aiosqlite:
  - `conftest.py`: in-memory SQLite engine (StaticPool so all connections share one DB),
    tables created via `SQLModel.metadata.create_all`, and a `client` fixture that overrides
    the `get_session` FastAPI dependency so no test touches the real Postgres/RDS config.
  - `tests/fakes/gemini.py`: a scripted fake for the google-genai Live API surface
    (`client.aio.live.connect(...)` -> async context manager -> session with
    `send_realtime_input` / `receive()` / `send_tool_response`), duck-typed to match exactly
    what `app/api/websocket.py` touches (`server_content.input_transcription`,
    `output_transcription`, `model_turn.parts`, `tool_call.function_calls`). This will be
    reused by the B1/B2/B3/B4/B6/B7 websocket tests later in the sprint.
  - `tests/test_smoke.py`: register/login/get-user round trip through the real app + fake DB,
    a duplicate-email rejection check, and a check that the fake Gemini fixture scripts a
    conversation end-to-end. 3 tests, all passing.
- `backend/requirements-dev.txt` (pytest, pytest-asyncio, aiosqlite) layered on top of the
  existing `requirements.txt` so prod deps are untouched.
- `backend/pytest.ini` (`asyncio_mode = auto`, function-scoped async fixtures).
- Root `Makefile` (`make test`, `make test-backend`, `make lint-frontend`,
  `make typecheck-frontend`).
- `.github/workflows/ci.yml`: runs backend pytest, and frontend `pnpm lint` +
  `pnpm exec tsc --noEmit` (see "Known pre-existing failures" below — the frontend jobs are
  wired up but not currently green, for reasons unrelated to this sprint's scope).
- `app.config.Settings` requires `gemini_api_key` and `db_host` with no default, so importing
  `app.main` (needed for the test client) throws at import time without them. `conftest.py`
  sets `GEMINI_API_KEY` / `DB_HOST` / `JWT_SECRET` env vars via `os.environ.setdefault` before
  the first app import so tests don't need a real `.env`.
- Test run: **before this task, 0 tests existed.** After: `3 passed` (`python -m pytest` in
  `backend/`, run locally in a fresh venv against `requirements-dev.txt`).

### A2 — Migrations: baseline schema was never actually created

- **Bug found (critical, pre-existing):** the whole Alembic chain (4 revisions) never created
  the `users`/`sessions` tables. `grep -rn "create_table\|drop_table" alembic/versions/`
  returned nothing. The root revision (`18680c0bb149_initial_tables`) and
  `0317cbf399f5_added_sessions` both had empty `upgrade()`/`downgrade()` bodies (`pass`). A
  real `alembic upgrade head` against a blank database would fail at the third revision
  (`ALTER TABLE sessions ADD COLUMN ...` before `sessions` exists). This was masked in
  practice because `database.py`'s `init_db()` called `SQLModel.metadata.create_all` on every
  app startup, which silently did the real schema creation — Alembic was decorative.
- **Fix:**
  - `18680c0bb149_initial_tables.py`: `upgrade()`/`downgrade()` now actually `create_table` /
    `drop_table` for `users` and `sessions` at their baseline (pre-role, pre-transcript/
    applicant_data/evaluation) columns.
  - `0317cbf399f5_added_sessions.py`: left as a no-op (revision id/chain preserved for any
    environment that already stamped `alembic_version`), with a comment explaining the table
    creation moved to the baseline revision.
  - `database.py`: removed the `create_all` call from `init_db()`. Migrations are now the sole
    schema authority.
  - `Dockerfile`: `CMD` now runs `alembic upgrade head` before starting uvicorn (idempotent on
    every container start). This was necessary because `.github/workflows/deploy-azure.yml`
    has no migration step of its own — without it, a fresh deploy would boot against an empty
    schema now that `create_all` is gone.
- **New regression test** `tests/test_migrations.py`: walks the full revision chain
  (`ScriptDirectory.walk_revisions(base="base", head="head")`) against a fresh in-memory
  SQLite database via `MigrationContext`/`Operations.context()`, applying each revision's
  `upgrade()` in order, then asserts the final `users`/`sessions` column sets match
  `models.py`. This is the test that would have caught the original bug.
  - Caveat: the head revision (`6a5febe4cf83_add_user_role_field`) ends with
    `op.alter_column("users", "role", nullable=False)`, which is valid Postgres DDL (the
    actual target dialect, per `env.py`/`config.py`/`docker-compose.yml`) but SQLite has no
    `ALTER TABLE ... ALTER COLUMN` support at all. The test catches that specific
    `OperationalError` and continues — by that point the same revision's `add_column`/`UPDATE`
    statements have already run (Alembic executes statements eagerly), so the schema
    assertions are unaffected. This is a SQLite-testing-only gap, not a real bug; not worth a
    `batch_alter_table` rewrite of the migration for a dialect the app never runs against.
- Verified before removing `create_all`: manually drove the corrected chain against
  in-memory SQLite via a standalone `MigrationContext`/`Operations.context()` script (same
  technique as the test) to confirm `create_table`/`add_column` produce the expected schema.
- Test run: **before this task, 3 passed** (A1's suite only). **After: 4 passed** (A1's 3 +
  this task's new `test_migrations.py`).

### A3 — Config hygiene: fail-fast secrets, complete `.env.example`, live-call settings

- **Bug found (security, pre-existing):** `jwt_secret` defaulted to the literal string
  `"change-me-in-production"`. If the env var was ever missing in a deployment, the app would
  start up fine and silently sign/verify auth JWTs with a public, guessable secret instead of
  refusing to start — a real auth-bypass risk, not just a footgun.
- **Fix:** `config.py`'s `jwt_secret` now has no default (same pattern already used for
  `gemini_api_key`/`db_host`), so `Settings()` raises at import time if it's unset. Confirmed
  the Azure deploy workflow already wires a real secret
  (`.github/workflows/deploy-azure.yml:98`, `JWT_SECRET=secretref:jwt-secret`), so this doesn't
  change deployed behavior — it only removes the silent-insecure-fallback path.
  `admin_creation_secret` was left alone: it defaults to `""`, and the route
  (`admin_routes.py:55`) already refuses to create an admin at all when it's unset, so an empty
  default is safe-by-construction rather than a vulnerability.
- New regression test `tests/test_config.py::test_missing_jwt_secret_fails_fast` spawns a
  subprocess with `JWT_SECRET` unset and asserts `import app.config` fails.
- **Live-call settings extracted:** `websocket.py`'s silence check-in constants
  (`CHECK_IN_INTERVAL=20`, `CHECK_IN_WAIT=15`, `MAX_CHECK_INS=2`) were hardcoded module
  globals. Moved into `Settings` as `checkin_silence_interval_seconds` /
  `checkin_wait_seconds` / `max_checkins`, same default values — purely a config-hygiene
  extraction (no behavior change), and it's what the later B1 silence-monitor fix will need to
  tune without editing code.
- **`.env.example` completeness:** it was missing `MODEL`, `MAX_INTERVIEW_DURATION`,
  `JWT_ALGORITHM`, and `ADMIN_CREATION_SECRET` (present in `Settings` but absent from the
  example file), plus the three new `CHECKIN_*` keys above. Added all of them, with the
  `JWT_SECRET` line updated to explain it's required (no default) and a one-line note that
  `ADMIN_CREATION_SECRET=""` disables the admin-creation endpoint.
- Test run: **before this task, 4 passed.** **After: 5 passed** (adds `test_config.py`).

### A4 — Split `websocket.py` into `app/interview/`

- **Refactor, no behavior change.** `backend/app/api/websocket.py` was a 477-line monolith
  mixing the route/auth boundary with the entire live-call orchestration (prompt text, Gemini
  client/config construction, silence monitor, transcript building, evaluation save, the
  forward-to/from-Gemini loops). Per the spec constraint ("do not redesign the interview
  questions or prompt"), every line of logic moved verbatim — no wording, schema, or control
  flow changed.
  - `app/interview/prompts.py`: `SYSTEM_INSTRUCTION` (byte-for-byte identical) and
    `build_end_session_tool()` (the `end_session` function-calling schema).
  - `app/interview/gemini_client.py`: `get_genai_client()` and `build_live_connect_config()` —
    also the seam future tests use to inject a fake Gemini client without a real network call.
  - `app/interview/handler.py`: `run_interview_session(websocket, session_id, user_id)`, the
    full session loop (silence monitor, `save_evaluation`, `forward_to_gemini`,
    `forward_from_gemini`, the outer `asyncio.wait`/cleanup/exception handling) — unchanged
    logic, just relocated.
  - `app/api/websocket.py` is now a thin route: accepts the socket, checks the `token` query
    param, decodes it, and delegates to `run_interview_session`. Satisfies the Definition-of-
    Done bullet "websocket.py becomes a thin route."
- **New test** `tests/test_websocket.py`: the first test to exercise the real `/ws/{session_id}`
  route end-to-end (previously `test_smoke.py`'s Gemini test only drove the fake fixture
  directly, never through the app). Uses `fastapi.testclient.TestClient` — not the async
  `httpx.AsyncClient` fixture from `conftest.py` — so register, create-session,
  open-websocket, and the post-hoc admin read all run through one event loop/thread. Mixing
  `TestClient`'s internal anyio portal with the aiosqlite connections from the async `client`/
  `test_engine` fixtures would bind those connections to two different event loops and error;
  this test builds and tears down its own aiosqlite engine instead. It monkeypatches
  `app.interview.handler.get_genai_client` and `app.interview.handler.get_session` (patched
  where they're *used*, since `handler.py` imports both names directly rather than going
  through FastAPI `Depends` — `app.dependency_overrides` alone doesn't reach those calls) to
  inject the scripted fake Gemini session and the test's own DB session provider. Scripts one
  user transcript fragment followed by an `end_session` tool call, then asserts over the
  websocket (`status` then `interview_ended`) and via `GET /api/admin/sessions/{id}` that the
  transcript, `applicant_data`, `evaluation`, and `completed_at` were actually persisted.
  - Note: an earlier draft of this test asserted `fake_session.closed is True` right after
    reading the `interview_ended` message. That's racy — `interview_ended` is sent *before*
    the `async with client.aio.live.connect(...)` block's `__aexit__` runs, so the assertion
    could fire before the server task finishes closing. Dropped it; the DB assertions aren't
    racy since `save_evaluation` is fully awaited before `interview_ended` is sent.
- Test run: **before this task, 5 passed.** **After: 6 passed** (adds `test_websocket.py`;
  confirmed the existing 5 pass unchanged with the new package layout before writing the new
  test, satisfying "run the test suite before and after").

### B2 — Session ownership + status check on WebSocket connect

- **Bug found (critical, pre-existing), confirmed by reading the code, not just inspection:**
  `websocket_endpoint` authenticated the *token* (who you are) but never checked it against
  the *session_id* in the URL (whose session this is). Any logged-in user could open
  `/ws/{any_session_id}` for a session they don't own — including one that already has a
  submitted evaluation — and the interview would run and overwrite that session's
  `transcript`/`applicant_data`/`evaluation`/`completed_at` via `save_evaluation`. This is
  both an authorization bug (cross-account data access) and a data-integrity bug (a completed
  submission could be silently clobbered by a second run).
- **Fix:** after token auth succeeds, `websocket.py` now loads the session via
  `SessionRepository.get_by_id` and rejects the connection before ever calling
  `run_interview_session`:
  - session doesn't exist -> close code `4004`, "Session not found"
  - `session.user_id != token's sub` -> close code `4003`, "You do not have access to this
    session"
  - `session.completed_at is not None` -> close code `4009`, "This interview has already been
    completed"
  - Each rejection sends the same `{"type": "error", "message": ...}` shape the client already
    handles for the existing token-auth-failure paths (`4001`), so the frontend doesn't need a
    new message format to at least surface *something* — a typed per-code UI (B11) is still
    later work.
- **New tests** in `tests/test_websocket.py`:
  - `test_websocket_rejects_connection_to_another_users_session`: registers an owner and an
    unrelated "intruder" user, creates a session for the owner, and asserts the intruder's
    websocket connection gets the `error`/access-denied message and then closes.
  - `test_websocket_rejects_connection_to_completed_session`: drives one real interview to
    completion through the websocket (reusing the scripted fake Gemini session from the A4
    test), then asserts a second connection attempt to that same, now-completed session_id is
    rejected with the "already been completed" message.
  - Both new tests, and the existing A4 websocket test, needed one more monkeypatch than
    before: `app.api.websocket.get_session` (previously only `app.interview.handler.get_session`
    was patched). The new ownership check calls `get_session()` directly from the route module,
    which — like `handler.py`'s direct call — bypasses `app.dependency_overrides` entirely
    since that only intercepts FastAPI `Depends(...)` resolution, not a plain function call.
- Test run: **before this task, 6 passed.** **After: 8 passed** (adds the two tests above).

### B3 — One live connection per session

- **Bug found (data-integrity, pre-existing), confirmed by reading the code:** nothing
  prevented two concurrent websocket connections from opening for the same `session_id` at
  once — e.g. a duplicate browser tab, or a client reconnecting before its stale connection
  actually closed. Both connections would independently drive the *same* underlying Gemini
  Live conversation state machine expectations while appending to two separate in-memory
  `transcript` lists and racing to call `save_evaluation` for the same session, corrupting
  whichever one lost the race.
- **Fix:** `app/interview/handler.py` now tracks in-flight sessions in a module-level
  `_active_connections: set[str]`. `run_interview_session` is now a thin wrapper: it rejects
  the connection (close code `4008`, message "This interview session already has an active
  connection") if `session_id` is already in the set, otherwise adds it and delegates to the
  renamed `_run_interview_session` (all the original logic, unchanged) inside a `try/finally`
  that always removes it again on exit. The check-then-add has no `await` between them, so
  it's race-free under asyncio's single-threaded cooperative scheduling — and the app already
  only ever runs as a single uvicorn worker (`backend/Dockerfile`: `--workers 1`, with a
  comment explaining why: in-memory session state can't be shared across worker processes
  anyway), so a process-local in-memory set is a correct source of truth here, not just a
  test-only convenience.
- **New test** `tests/test_websocket.py::test_websocket_rejects_second_concurrent_connection_to_same_session`:
  opens one websocket connection and, while it's still open (never sends `end_session`, so
  the interview stays active), opens a second connection to the same `session_id` and asserts
  it's immediately rejected with the "active connection" error. Needed a small addition to
  the shared fake, `tests/fakes/gemini.py`'s `FakeLiveSession`: a new `hang_when_exhausted`
  constructor flag (default `False`, so every existing test's behavior is unchanged) that
  makes `receive()` suspend forever once its scripted responses run out instead of ending the
  generator — matching how the real Gemini Live API's `receive()` actually behaves while
  waiting for the next server message, and letting this test keep a connection "open" on
  purpose without a real network call.
- Test run: **before this task, 8 passed.** **After: 9 passed** (adds the test above).

### B4 — Turn-based transcript coalescing

- **Bug found (data-quality, pre-existing), confirmed by reading the code and the real
  `google.genai.types.LiveServerContent` model:** Gemini's Live API streams
  `input_transcription`/`output_transcription` as a series of fragments as the user/model
  speaks -- it does not send one message per completed turn. `forward_from_gemini` appended a
  brand-new transcript entry for every single fragment it received, so one sentence a person
  spoke would show up in the saved transcript as several disjoint `"role": "user"` rows
  (e.g. `"Hello,"`, `" I'm"`, `" excited about robotics."`) instead of one coherent turn. This
  is exactly the "transcript is fragment-based not turn-based" bug called out in the spec's
  Definition of Done.
- **Fix:** `app/interview/handler.py` now tracks a `current_turn` buffer alongside
  `transcript`. `append_turn_text(role, text)` appends `text` onto `current_turn` if it's the
  same role as the fragment just received, or finalizes the previous turn (pushing it onto
  `transcript`) and starts a new one if the role changed. `finalize_current_turn()` is called
  at every point a turn can legitimately end: on the model's own `turn_complete` signal (a
  real field on `LiveServerContent`, previously read by nothing in this codebase), right
  before `save_evaluation` runs in the `end_session` tool-call path, and once more after the
  outer `asyncio.wait()` resolves (covering disconnect and time-limit-reached paths) so no
  in-progress turn is silently dropped from the transcript that gets saved.
- **New test** `tests/test_websocket.py::test_websocket_coalesces_streamed_transcription_fragments_into_one_turn`:
  scripts three consecutive `user_transcript(...)` fragments ("Hello, " / "I'm excited " /
  "about robotics.") followed by `end_session_call(...)`, then asserts the persisted
  transcript has exactly one `"role": "user"` entry whose text is the full concatenated
  sentence, not three.
- Test run: **before this task, 9 passed.** **After: 10 passed** (adds the test above; the 9
  pre-existing tests were unaffected since none of them scripted more than one fragment per
  role, so coalescing had nothing to change in their assertions).

### B6 — Reliable end-of-interview + fallback save on all exit paths

- **Bug found (data-integrity, pre-existing), confirmed by reading the code:** the only signal
  that an interview had finished was `completed_at` (nullable). Every non-`end_session` exit
  path — a disconnect before the applicant said anything, a disconnect mid-interview, the
  presentation-time-limit timeout, or an unhandled exception — left `completed_at` untouched
  and simply logged a message. There was no persisted signal that an interview had even been
  attempted; a session that never got an `end_session` tool call stayed indistinguishable from
  one nobody ever opened. The one existing fallback (`if not evaluation_saved and transcript:
  save_evaluation({...fabricated "needs_review" evaluation...})`) only fired when the
  transcript was non-empty, so an empty-transcript disconnect (the single most common case —
  someone opens the tab and immediately closes it) persisted nothing at all. Fabricating a fake
  AI evaluation dict to represent "this needs human review" was also a data-quality smell in
  its own right, conflating "the AI evaluated this" with "nobody evaluated this."
- **Fix:** added a real `status` field (`"in_progress" | "completed" | "incomplete"`) to
  `Session`/`SessionResponse`/`SessionTable`, backed by a new Alembic migration
  (`08842b9483e2_add_status_to_sessions`, new head, revises `6a5febe4cf83`) that adds the
  column with `server_default="in_progress"` and backfills `status='completed'` for any row
  that already has `completed_at` set. `SessionRepository.complete()` now also sets
  `status = "completed"`; a new `SessionRepository.mark_incomplete()` sets
  `status = "incomplete"` without touching `completed_at`. `app/interview/handler.py` replaced
  the fabricated-evaluation fallback with a `mark_incomplete()` closure (persists whatever
  transcript exists, then marks the session incomplete) called from every non-success exit:
  the main flow when `asyncio.wait()` resolves without `end_session` having run (covers both
  disconnect and the time-limit timeout), and both outer exception handlers (`WebSocketDisconnect`
  raised before the Gemini session even opens, and the generic `Exception` handler) — neither of
  which previously did any DB work at all on their way out. This satisfies the Definition of
  Done's "disconnect mid-interview always leaves a saved transcript with status `incomplete`,"
  including the previously-unhandled empty-transcript case.
- **New tests** in `tests/test_websocket.py`:
  - `test_websocket_disconnect_before_any_speech_marks_session_incomplete`
  - `test_websocket_disconnect_mid_interview_marks_session_incomplete_with_partial_transcript`
  - Both needed a test-harness-specific workaround, not a handler.py change: Starlette's
    `TestClient.websocket_connect(...)` context manager, on `__exit__`, sends the disconnect
    message and then unconditionally cancels the server-side task's cancel scope
    (`WebSocketTestSession._run`'s task group calls `tg.cancel_scope.cancel()` as soon as
    `should_close` fires, with no wait for the app's own disconnect-handling coroutine to
    finish first). Against this app's shared in-memory aiosqlite `StaticPool` connection, that
    forced cancellation landed mid-transaction inside `mark_incomplete()`'s DB write, and
    aiosqlite's cancellation-driven `terminate_force_close()` isn't implemented for this DBAPI
    shim (`NotImplementedError`), which killed the single shared `:memory:` connection and broke
    every later query in that test (`no such table: users`). Confirmed this doesn't reproduce
    in production: real uvicorn just delivers a `websocket.disconnect` ASGI event and lets the
    handler's own exception path run to completion normally — nothing external cancels it. The
    fix is entirely test-side: call `ws.close(1000)` manually *inside* the `with
    websocket_connect(...)` block to trigger the disconnect, then poll
    `GET /api/admin/sessions/{id}` (still inside the block) until `status` leaves
    `"in_progress"`, so the app's cleanup coroutine finishes on its own *before* the block exits
    and the harness's cancellation becomes a no-op against an already-finished task.
- Test run: **before this task, 10 passed.** **After: 12 passed** (adds the two tests above;
  confirmed the pre-existing 10 pass unchanged after the schema/repository additions before
  writing the new handler.py logic, satisfying "run the test suite before and after").

### B7 — Evaluation save robustness: a failed save was always reported as success

- **Bug found, confirmed by reading the code:** in `app/interview/handler.py`'s `end_session`
  tool-call handler, `await save_evaluation(args)` was called and then, unconditionally and
  regardless of the outcome, the code sent the client an `interview_ended` message and Gemini a
  `{"status": "success"}` tool response. `save_evaluation()` itself wrapped its whole body in a
  bare `except Exception as e: logger.error(...)` with no re-raise and no return value — so a
  malformed tool-call payload (e.g. `recommendation` outside the enum already declared in
  `build_end_session_tool()`) or a transient DB error during the write both silently produced
  *zero* persisted evaluation data while telling both the applicant and the model the save had
  succeeded. This is exactly the Definition of Done's "a failed evaluation save is never reported
  as success."
- **Fix (validation, retry, honest branching, dead-letter — no new scoring, no schema-column
  churn):**
  - `validate_end_session_args()` checks the tool-call args against the *existing*
    `build_end_session_tool()` schema already declared to Gemini (dict `applicant_notes`,
    non-empty string `overall_impression`, `recommendation` in the same four-value enum already
    declared to the model, numeric 1–10 `overall_score` if present, list-of-strings
    `strengths`/`concerns` if present) and raises `ValueError` on the first mismatch. This
    validates shape only — it does not add any new evaluation criteria or scoring logic.
  - `save_evaluation()` now returns `bool`. On validation failure it dead-letters immediately
    (no point retrying a payload that will never parse). On a valid payload, it retries the same
    four repo calls (`update_transcript`, `update_applicant_data`, `update_evaluation`,
    `complete`) — safe to retry as a whole because all four are pure overwrites, not new
    "atomic" plumbing — up to `settings.evaluation_save_max_attempts` (default 3) times, sleeping
    `settings.evaluation_save_retry_delay_seconds` (default 0.5s) between attempts. Both new
    settings follow the existing `checkin_*` `Settings`/`.env.example` pattern from A3.
  - On final failure (invalid args, or DB write failed after all retries), `dead_letter_evaluation()`
    persists `{"evaluation_save_failed": True, "reason": ..., "raw_args": args}` into the
    *existing* `evaluation` JSON column and calls the existing `mark_incomplete()` — deliberately
    not adding a new `analysis_status` column/migration, to keep this a bug fix rather than a
    schema change.
  - The `end_session` tool-call handler now branches on `save_evaluation()`'s return value:
    on success, the client/Gemini messages are byte-for-byte unchanged from before this fix; on
    failure, the client gets an honest "we were unable to save your evaluation" message and
    Gemini gets `{"status": "error"}` instead of a false `"success"`.
- **New tests** in `tests/test_websocket.py`:
  - `test_websocket_end_session_with_invalid_recommendation_never_reports_success` — an
    out-of-enum `recommendation` results in an "unable to save" client message, session
    `status: "incomplete"`, and a dead-letter marker (`evaluation_save_failed: true`, reason
    containing `"invalid args"`) in the `evaluation` column, never `"completed"`.
  - `test_websocket_end_session_dead_letters_after_persistent_db_failure` — monkeypatches
    `SessionRepository.complete` to always raise, with `evaluation_save_max_attempts=2` and a
    near-zero retry delay for test speed, and asserts the same never-reports-success outcome
    after retries are exhausted, with the dead-letter reason naming the attempt count.
  - Both needed one more test-harness-only fix, unrelated to the B7 logic itself: the
    `/api/login` endpoint's `slowapi` rate limiter (`app/api/user_routes.py`) is a module-level
    `Limiter` whose counters live for the entire pytest process and are keyed by a remote address
    that's identical for every `TestClient` call. This file mints several admin tokens (each one
    real login), and once the total logins across the file passed the "5/minute" quota, later
    tests started getting `429`s from a *shared* counter that no test had ever reset. Added an
    autouse `_reset_login_rate_limit` fixture in this file that calls `login_limiter.reset()`
    before each test — a test-isolation fix, not a change to the production rate limit (that
    limit itself is in scope for B14, not this task).
- Test run: **before this task, 12 passed.** Ran once after the `handler.py` changes and before
  writing new tests to confirm the pre-existing 12 still passed unchanged (satisfying "run the
  test suite before and after"). **After adding the two new tests and the rate-limiter fixture:
  14 passed**, confirmed stable across three consecutive full-suite runs.

### B1 — Fix dead silence monitor + suppress check-ins during agent speech

- **Bug found, confirmed by reading the code (backend) plus a targeted read of the frontend
  audio path:** in `app/interview/handler.py`, `forward_to_gemini()` reset
  `last_user_speech = datetime.now(timezone.utc)` and `check_in_count = 0` on *every single*
  binary websocket message received from the client (`async for data in websocket.iter_bytes()`),
  with no check on content. `frontend/app/apply/interview/page.tsx` feeds a raw 16kHz PCM stream
  from an `AudioWorkletNode` (`frontend/public/pcm-processor.js`) that fires on every ~8ms
  audio-render quantum with no amplitude/VAD gating — so audio chunks arrive constantly for the
  entire time the mic is open, silence included, and even during the agent's own TTS playback
  (the mic stays hot; only `echoCancellation: true` mitigates). That means `last_user_speech` was
  effectively always "now," `silence_duration` could never accumulate past `CHECK_IN_INTERVAL` in
  practice, and the check-in mechanism was structurally dead — it could not fire regardless of
  actual user inactivity. Separately, there was no "agent is speaking" state anywhere (frontend or
  backend), so even if the monitor had worked, it would have been free to check in on the user
  during the agent's own turn, which is expected silence, not inactivity.
  - Considered and deliberately rejected: driving the fix off the Live API's
    `voice_activity`/`voice_activity_detection_signal` fields. Confirmed via direct inspection of
    the installed `google-genai==1.70.0` package that these fields exist on
    `types.LiveServerMessage`, but the SDK's own field description marks
    `voice_activity_detection_signal` "Allowlisted only" — it may not be populated for this
    project's API tier, which would make a fix built on it silently a no-op. Used only signals
    already proven to work in this codebase instead: `sc.input_transcription.text` (real user
    speech, backed by Gemini's own server-side VAD — `automatic_activity_detection` is already
    enabled in `build_live_connect_config()`), `sc.model_turn` (agent producing audio), and
    `sc.turn_complete` (agent's turn ending).
- **Fix (signal swap, no new scoring, no prompt changes):**
  - Renamed `last_user_speech` → `last_activity`: it now means "start of the current window during
    which it's the user's turn to speak and they haven't yet," not "last time raw bytes arrived."
  - Added `agent_speaking: bool`, `False` initially, `True` whenever `sc.model_turn` is present,
    `False` again once `sc.turn_complete` fires.
  - Removed the blind per-chunk reset from `forward_to_gemini()` — raw bytes reaching the server
    are no longer treated as evidence of speech.
  - `last_activity` now resets in exactly two places: when `sc.input_transcription.text` is
    non-empty (confirmed real speech), and when `sc.turn_complete` fires (the agent just finished
    talking, so a fresh "waiting for the user" window starts).
  - `silence_monitor()` skips its check-in logic entirely for a cycle whenever `agent_speaking` is
    `True` — directly implements "suppress check-ins during agent speech."
- **New tests** in `tests/test_websocket.py`:
  - `test_silence_monitor_fires_despite_continuous_audio_with_no_real_speech` — sends continuous
    raw audio bytes (mirroring the real frontend's VAD-less stream) with no scripted user speech
    ever transcribed, and asserts a `check_in` message still arrives. Verified this is a real
    regression test, not a vacuous one: temporarily reverted just `handler.py` (`git stash push
    --keep-index -- app/interview/handler.py`) and re-ran it against the pre-fix code — it failed
    with "no check_in arrived despite continuous silence," then re-ran clean after popping the
    stash back.
  - `test_silence_monitor_suppresses_check_in_while_agent_is_speaking` — scripts a `model_turn`
    response with no following `turn_complete` (so `agent_speaking` stays `True` indefinitely) and
    asserts no `check_in` ever arrives. Same before/after verification: against the pre-fix code
    this failed with `DID NOT RAISE queue.Empty` (log showed `Check-in 1/1` actually being sent),
    then passed clean after restoring the fix.
  - Both tests read from Starlette's `WebSocketTestSession._send_queue` directly with a bounded
    `queue.Queue.get(timeout=...)` instead of `ws.receive_json()`, because `receive_json()` blocks
    on the same queue with no timeout — if a fix regresses (a message that should arrive never
    does, or vice versa), an un-timed-out call would hang the test indefinitely instead of failing
    cleanly. This is test-harness-only; production code is untouched by it.
- Test run: **before this task, 14 passed** (from B7). Ran the full suite once right after the
  `handler.py` changes and before writing any new test, confirming the pre-existing 14 still
  passed unchanged. **After adding the two new tests: 16 passed.**

### B15 — Logging hygiene: no PII at INFO, session_id correlation

- **Bug found, confirmed by reading the code:** grepped every `logger.*` call under `app/` and
  found two problems.
  - `app/api/admin_routes.py`'s `create_admin_account` logged
    `f"Admin account created: {email}"` at INFO — the admin's raw email, landing in default
    production logs.
  - `app/interview/handler.py`'s `forward_from_gemini()` logged the applicant's own transcribed
    speech verbatim at INFO (`f"User: {sc.input_transcription.text}"`) and the agent's spoken text
    the same way (`f"Gemini: {part.text}"`) — the actual interview content, not just metadata,
    also landing in default production logs.
  - Separately, roughly a third of the `logger.*` calls in `handler.py` (e.g. "Client disconnected
    (receive path)", "Presentation time limit reached", "Connection closed...") carried no
    `session_id` at all, making them useless for correlating a log line with the specific
    interview it came from — the surrounding calls in the same function already do include it, so
    this was an inconsistency, not a deliberate omission.
- **Fix (logging-only, no behavior change to interview logic or admin creation):**
  - `admin_routes.py` now logs `admin.id` instead of `email`.
  - The two content-bearing `handler.py` logs are demoted from `logger.info` to `logger.debug` —
    still available for local debugging (`logging.basicConfig(level=logging.DEBUG)`), absent from
    the app's default INFO-level production config (`app/main.py`).
  - Every remaining `logger.*` call in `handler.py`'s `_run_interview_session` (and its nested
    closures, which all close over the same `session_id` parameter) now includes `session_id` in
    the message text, matching the calls that already did.
- **New tests** in `tests/test_websocket.py`, both using pytest's `caplog` fixture:
  - `test_admin_creation_log_omits_email` — creates an admin account and asserts no captured log
    record contains the email, while the creation event itself is still observable.
  - `test_interview_logs_omit_transcript_content_at_info_and_include_session_id` — scripts a
    `user_transcript(...)` response containing a distinctive sensitive string, asserts no INFO-level
    record contains that string, and asserts the session's `session_id` appears in at least one
    INFO record.
  - Verified both are real regressions, not vacuous: temporarily reverted just
    `handler.py`/`admin_routes.py` (`git stash push --keep-index -- ...`) and re-ran the two new
    tests against the pre-fix code — both failed (email and transcript text both showed up in the
    captured INFO records), then passed clean after popping the stash back.
- Test run: **before this task, 16 passed** (from B1). Ran the full suite once right after the
  logging changes and before writing any new test, confirming the pre-existing 16 still passed
  unchanged. **After adding the two new tests: 18 passed.**

### A7 — Split frontend `interview/page.tsx` into hooks

- **Before:** `frontend/app/apply/interview/page.tsx` was one 850-line client component mixing
  auth redirect, session creation, camera/mic permission probing, the Gemini Live websocket,
  raw audio capture/playback (AudioWorklet + AudioContext), on-device `MediaRecorder`, upload of
  the finished recording, the interview timer, and three full JSX screens (instructions / active
  call / completed) — all sharing one flat pile of `useState`/`useRef` with no seams, so any new
  feature (e.g. reconnection handling in B10, or typed error states in B11) would have to be
  wedged into the same function.
- **Fix (pure extraction, no logic changes):** pulled the non-JSX logic out into four hooks under
  `frontend/hooks/`, moving state/refs/callbacks verbatim (same variable names, same effect
  dependency arrays, same control flow) rather than rewriting any of it:
  - `use-auth-guard.ts` — the localStorage userId check + `/signin` redirect.
  - `use-media-permissions.ts` — `checkMediaPermissions` and its `micDenied`/`noCamera`/
    `checkingMedia`/`audioOnly` state (setters exposed, since the caller in
    `use-interview-call.ts` sets `audioOnly`/`noCamera`/`micDenied` directly in a couple of
    places based on its own logic, matching the original component's behavior).
  - `use-recording-upload.ts` — the effect that uploads the recorded blob once available;
    takes `sessionId`/`hasRecording`/the recorded-blob ref as arguments so it has no dependency
    on the audio/websocket internals.
  - `use-interview-call.ts` — the big one: session creation, the websocket connection and all its
    handlers, audio capture (AudioWorklet) and playback (raw PCM scheduling), `MediaRecorder`
    wiring, the timer, and the unmount cleanup effect. Composes the two hooks above internally.
  - `page.tsx` is now ~430 lines of JSX only, calling `useAuthGuard()` and
    `useInterviewCall(userId)` and rendering their returned state — no imperative logic left in
    the component body except the page-level `screenState`/`showConfetti` transition, which
    stays here since it's about *this page's* screens, not the call itself.
- **Verification (no test runner exists for the frontend — see "Known pre-existing failures" —
  so this used every check that was available instead of skipping verification):**
  - `npx tsc --noEmit`: identical output before and after (the same 3 pre-existing, unrelated
    errors in `app/admin/applicant/[id]/page.tsx` and `app/apply/form/page.tsx`; zero errors in
    any of the touched files).
  - `npx next build`: compiles successfully, `/apply/interview` still prerenders as a static
    route.
  - Ran `next dev` on a scratch port and `curl`'d `/apply/interview`: 200, renders the expected
    (unauthenticated) loading state — same first paint as before the refactor, since the
    auth-guard redirect logic is unchanged.
  - Diffed the extracted hooks against the original inline code line-by-line to confirm every
    state variable, ref, callback dependency array, and the one pre-existing quirk (the "Start
    Interview" button calling `checkMediaPermissions()` once itself and then again inside
    `startPresentation()`) were carried over unchanged rather than "fixed" — that quirk is
    B9/B11 territory, not in scope for a behavior-preserving split.
- No new tests added: there is nothing here yet that's meaningfully unit-testable without a
  browser (the hooks still call `navigator.mediaDevices`, `AudioContext`, `MediaRecorder`,
  `WebSocket` directly) — B9 (audio pipeline hardening) is the task that's expected to introduce
  the seams (e.g. an injectable audio-pipeline interface) that would make these actually
  testable in CI. Splitting into hooks now is what makes that seam possible later.

### B9 — Audio pipeline hardening

Task description covered five things; confirmed each by reading the code before touching
anything, per the sprint's "confirm before fixing" rule.

1. **Worklet posts every render quantum (~8ms), not batched.** `frontend/public/pcm-processor.js`
   called `port.postMessage` unconditionally inside `process()`, which the Web Audio spec fires
   once per 128-sample render quantum — at 16kHz that's a websocket-bound message every ~8ms
   instead of a reasonable ~20-40ms batch.
   - **Fix:** accumulate incoming render quanta into an internal buffer and only post once
     `bufferedLength` reaches 512 samples (32ms @ 16kHz), merging the buffered `Float32Array`
     chunks before the existing Int16 conversion. Wire format to the backend is unchanged (still
     raw concatenated Int16 PCM bytes) — only the chunking cadence changed.
2. **No `AudioContext.resume()` anywhere.** `grep -rn "resume(" hooks/ app/ public/` returned zero
   matches. Both `captureCtxRef` (16kHz) and `playbackCtxRef` (24kHz) are constructed inside
   async callbacks (`ws.onopen`, and `playPCM`'s lazy-recreate fallback) with no resume/state
   check — Safari/iOS can hand back a context in `"suspended"` state when construction happens
   without a sufficiently fresh user gesture, silently dropping all subsequent audio.
   - **Fix:** added `if (ctx.state === "suspended") await ctx.resume()` right after constructing
     both contexts in `ws.onopen`, and the same synchronous check (best-effort, not awaited,
     since `playPCM` isn't async) in `playPCM`'s lazy-recreate branch.
3. **`stopCapture()` never stopped the recording-mix destination track.** It stopped
   `streamRef.current`'s tracks and closed `playbackCtxRef`, but per Web Audio spec, closing an
   `AudioContext` does not stop a `MediaStreamAudioDestinationNode`'s own output track — the
   track feeding `MediaRecorder` via `mixedStream` could stay `"live"` after cleanup.
   - **Fix:** `stopCapture()` now explicitly stops `audioDestRef.current.stream`'s tracks before
     nulling `audioDestRef` and closing `playbackCtxRef`. (The "reuse one getUserMedia stream"
     half of this item was already satisfied — one real capture call in `ws.onopen`, reused for
     video/mic/mix; the two probe-only calls in `use-media-permissions.ts` are a separate,
     pre-existing, already-documented quirk from A7, not a leak since they stop their tracks
     immediately — left alone.)
4. **Playback queue burst-catch-up:** read `playPCM`'s scheduling math
   (`Math.max(ctx.currentTime, nextPlayAtRef.current)`) and confirmed it already handles both
   burst arrival and falling behind correctly — **no bug, no fix needed.**
   **Barge-in flush via server `interrupted` signal:** confirmed via
   `grep -n "interrupted" backend/app/interview/handler.py` that the backend read
   `input_transcription`/`output_transcription`/`turn_complete`/`model_turn` off
   `server_content` but never `sc.interrupted` — the field Gemini sets when a user's barge-in
   cuts the agent's turn short. The frontend had no message type to flush already-queued
   playback audio either, so a barge-in would talk over the user with stale audio.
   - **Fix (backend):** `backend/app/interview/handler.py`, `forward_from_gemini()` — added
     `if sc.interrupted: await websocket.send_text(json.dumps({"type": "interrupted"}))` as the
     first check inside the existing `if response.server_content:` block.
   - **Fix (frontend):** `use-interview-call.ts` now tracks every scheduled
     `AudioBufferSourceNode` in `scheduledSourcesRef` (pushed in `playPCM`, removed via
     `onended`). A new `flushPlayback()` stops every currently-tracked source and resets
     `nextPlayAtRef` to the context's current time. `ws.onmessage` calls it on
     `msg.type === "interrupted"`. `stopCapture()` also clears the ref on session end.
5. **Agent audio mixed into the recording destination:** read the wiring — `playPCM` connects
   each scheduled source to both `ctx.destination` (speakers) and `audioDestRef.current`
   (recording mix), and `micSource` is connected to the same `audioDestRef` in `ws.onopen` — both
   sides of the conversation correctly reach the recorded track. **Confirmed correct, no fix.**
   Noted one narrow, low-value edge case and left it alone: if `playPCM` fires for a
   message that arrives in the brief window after `stopCapture()` has already nulled
   `audioDestRef`, that chunk still plays to speakers but is skipped from the recording mix
   (`if (audioDestRef.current)` guard) — narrow race, at most a fraction of a second of trailing
   agent audio, not worth the synchronization complexity to close.

Also fixed, same theme (AudioContext hardening) though not explicitly one of the five bullets:
**`playCheckInSound()`** created a `new AudioContext()` on every check-in beep and never closed
it. Bounded by `MAX_CHECK_INS` (small) so not a severe leak, but a real one and a one-line fix —
added `osc.onended = () => ctx.close()`.

- **Verification:**
  - Backend: added `test_websocket_forwards_interrupted_signal_to_client` in
    `backend/tests/test_websocket.py`, scripting a `FakeServerContent(interrupted=True)` response
    (the fake already had this field defined, unused, before this fix) and asserting the client
    receives `{"type": "interrupted"}`. Verified it's a real regression test: temporarily replaced
    the working `handler.py` with the pre-fix version from `HEAD` (`git show HEAD:... >
    handler.py`), reran — failed; restored the fix — passed. Full suite: **19 passed** (18 before
    + this 1 new test), confirming no regressions in the existing 18.
  - Frontend: `npx tsc --noEmit` — identical output to A7's baseline (same 2 pre-existing,
    unrelated errors in `app/admin/applicant/[id]/page.tsx` and `app/apply/form/page.tsx`; zero
    new errors). `npx next build` — compiles, same route shapes as before.
  - No new frontend unit tests: every fix here (worklet buffering, `AudioContext.resume()`,
    track cleanup, `AudioBufferSourceNode` scheduling/flush) is pure browser-API sequencing with
    no extractable business logic and no test runner in this repo (per the sprint's own
    carve-out: "for frontend, a unit test of the extracted logic, since browser audio cannot be
    tested in CI" — there is no pure logic here to extract, unlike the backend half of the fix).

### B8: Recording upload flow (idempotent, retryable, ownership-checked)

Confirmed by reading the code (backend confirmed directly; frontend confirmed directly after an
initial Explore-agent survey), then fixed:

1. **No ownership check (backend, security bug).** `POST /api/upload-recording` injected
   `current_user` via `Depends(get_current_user)` but never compared it against the session's
   owner — any authenticated user could upload a recording to any `sessionId` they could guess or
   enumerate. Fixed in `backend/app/api/session_routes.py`: the route now fetches the session
   first and checks `session_obj.user_id != current_user.id`, returning 404 if the session doesn't
   exist and 403 if it belongs to someone else, mirroring the existing ownership-check pattern
   already used on the `/ws/{session_id}` connect path in `app/api/websocket.py`.
2. **Not idempotent (backend).** `UploadRecordingUseCase.execute()` hard-blocked any second
   upload attempt for a session (`"Recording already uploaded for this session"`) even though the
   storage key is already deterministic (`recordings/{session_id}/{filename}`), and both storage
   backends (`S3Client.upload_file`'s local-filesystem `write_bytes` and its S3 `put_object`) both
   naturally overwrite on that key. So a client retry after a network blip that actually succeeded
   server-side got a permanent, un-retryable error instead of an idempotent overwrite. Fixed by
   removing the blocking check in `backend/app/use_cases/session_use_cases.py` — re-uploading now
   overwrites in place.
3. **Runaway auto-retry loop (frontend, worse than the originally-suspected "no retry").**
   `use-recording-upload.ts`'s effect depended on `uploading` and had no "already tried, give up"
   flag: on failure, `setUploading(false)` in the `.finally()` changed a dependency the effect
   itself was watching, so the effect re-fired immediately and re-attempted the upload again —
   forever, with zero backoff, silently hammering the server on every render. (An earlier Explore
   pass mischaracterized this as "no retry mechanism"; reading the effect's dependency array
   directly showed it was the opposite — an uncontrolled infinite retry.) Fixed by adding an
   `autoAttemptedRef` guard so the automatic attempt fires exactly once, and exposing the same
   `attemptUpload` function as a `retryUpload` return value for **user-initiated** retries instead.
4. **No retry button, no beforeunload warning (frontend, matches task description).** Added a
   "Retry upload" button in `frontend/app/apply/interview/page.tsx`'s `uploadError` block, wired to
   the new `retryUpload` from the hook (disabled while `uploading`). Added a `beforeunload`
   listener in `use-recording-upload.ts`, active while `uploading` or `uploadError` is set (i.e.
   the recording isn't safely saved yet), warning the user before they navigate away and lose the
   only copy of their interview recording.
5. **Size/content-type validation** (`MAX_UPLOAD_SIZE`, `ALLOWED_CONTENT_TYPES` in
   `session_routes.py`) was already correctly implemented — confirmed by reading, no fix needed.

- **Verification:**
  - Backend: added `backend/tests/test_upload_recording.py` — four tests covering the ownership
    rejection, a missing-session 404, re-upload-overwrites idempotency, and concurrent uploads to
    the same session (via `asyncio.gather`) both succeeding. Verified as real regressions:
    temporarily replaced `session_routes.py` and `session_use_cases.py` with their pre-fix `HEAD`
    versions (`git show HEAD:... > file`, backup/restore via `/tmp`), reran — the ownership and
    idempotency tests failed as expected (the 404 and concurrency tests still passed, since those
    behaviors were already correct); restored the fix — all 4 passed. Full suite: **23 passed**
    (19 before + these 4 new), confirming no regressions in the existing 19.
  - Frontend: `npx tsc --noEmit` — zero new errors (same 2 pre-existing, unrelated errors as A7's
    baseline; grepped the output for the touched files specifically — no matches). `npx next
    build` — compiles, same route shapes as before.
  - No new frontend unit test for the retry-loop/beforeunload fix: it's `useEffect`
    dependency-array sequencing and a native browser event listener, not extractable pure logic,
    and there's no test runner in this repo (same carve-out as B9).

### B11: Actionable typed error states in interview UI

Confirmed by reading the code, then fixed. Task description: "Replace generic error with typed
causes (mic denied, no device, camera denied w/ audio-only continuation, ws auth failure, session
completed, server error, connection lost) mapped from server typed errors."

1. **Server-sent error text was captured, then thrown away (frontend, the core bug).** Every
   server-side rejection path (`backend/app/api/websocket.py`'s `_reject()` for auth/ownership/
   not-found/already-completed, and `backend/app/interview/handler.py` for duplicate-connection and
   internal errors) already sends a specific, human-readable `{"type": "error", "message": "..."}`
   text frame before closing the socket with a matching code (4001/4003/4004/4008/4009). But
   `use-interview-call.ts`'s `ws.onmessage` handler for `msg.type === "error"` did only
   `setStatus("error")` — the `message` field was read off the parsed JSON and discarded. Every
   distinct failure (wrong user, session already submitted, duplicate tab, missing API key,
   internal exception) rendered as the same bare "Connection error" pill with no explanation and no
   next step. Fixed by adding an `errorMessage` state, set from `msg.message` in that branch and
   rendered in a new destructive `Alert` in `page.tsx` (gated on `status === "error" && errorMessage`).
2. **`ws.onclose`/`ws.onerror` had no fallback for closes with no message (frontend).** A genuine
   network drop or server crash never sends the `"error"` text frame — only `onclose` fires, with no
   information captured. Fixed `ws.onclose` to classify by `event.code`: skip if a specific message
   already arrived (checked via current `status`, since the message frame always precedes the close
   frame so `status` is already `"error"` by the time `onclose` runs); otherwise use a
   `CLOSE_CODE_MESSAGES` map for the known 4xxx codes as a backstop, or "Connection lost. Please
   check your network and try again." for anything else while a call was `active`/`connecting`.
   Moved all classification into `onclose` and left `onerror` a no-op, since browsers always fire
   `close` after `error` for WebSocket and doing it in both places created a race where `onerror`
   could mark `status` `"error"` before `onclose` had a chance to attach the actual message.
3. **Camera-permission-denial was unhandled (frontend, matches "camera denied w/ audio-only
   continuation").** `use-media-permissions.ts` only set `noCamera` for `NotFoundError`/
   `DevicesNotFoundError`/`NotReadableError` on the video `getUserMedia` call. A user who denied the
   camera permission prompt specifically got `NotAllowedError`, which neither the `micDenied` nor
   `noCamera` branch matched — no state was set, no audio-only fallback triggered, no message shown.
   Added a distinct `cameraDenied` state for this case (same audio-only fallback as `noCamera`, but
   a different message: allowing camera access in settings fixes it, whereas `noCamera`'s device
   issue would not be fixed by a permission grant). Also removed a stray `setNoCamera(true)` in
   `use-interview-call.ts`'s `startPresentation` that ran whenever `!media.hasVideo` regardless of
   cause — it was overwriting `checkMediaPermissions`'s own, more specific `noCamera`/`cameraDenied`
   distinction every time.
4. **Local getUserMedia/socket failures inside `ws.onopen` had no message.** The `catch` block
   around the post-connect `getUserMedia`/`AudioWorklet` setup only did `setStatus("error")`. Added
   an `errorMessage` there too ("Could not start your camera or microphone...").
5. **mic denied / no camera device** were already handled with dedicated, actionable `Alert`s in
   `page.tsx` before this fix — confirmed by reading, no fix needed for those two specifically.

- **Verification:**
  - No backend changes — full suite re-run to confirm unaffected: **23 passed** (unchanged from B8).
  - Frontend: `npx tsc --noEmit` — zero new errors (same 2 pre-existing, unrelated errors as B8's
    baseline; grepped the output for the touched files specifically — no matches). `npx next build`
    — compiles, same route shapes as before.
  - No new frontend unit test: the `CLOSE_CODE_MESSAGES` map is genuinely pure/extractable logic
    (unlike B8/B9's browser-event-sequencing fixes), but there is still no test runner in this repo
    (no jest/vitest/ts-node in `package.json`, no test script) — adding one for a single lookup map
    would be a disproportionate infra change for this sprint's scope. Manually verified the mapping
    against the server's actual close codes by re-reading `websocket.py`/`handler.py` directly.
    Flagged as a real gap, not silently skipped — worth revisiting if/when a frontend test runner is
    added (see A9 dead-code/tooling triage).

### B12: Real question-progress tracking from server; timer thresholds from configured duration

Confirmed by reading the code, then partially fixed — one half done, one half deliberately
descoped this sprint (see finding 2). Task description: "Replace client-side 'Question N' text
parsing (server never sends it) with server-sent `{type:'progress', question:N}` via lightweight
tool call behind flag. Timer color thresholds derived from configured max duration, not hardcoded."

1. **Dead regex parsing confirmed and removed (frontend).** `use-interview-call.ts`'s `"status"`
   branch did `msg.message?.match(/Question (\d+)/i)` to derive `currentQuestion`. Grepped all of
   `backend/app/` for the literal string `"Question"` — the only matches are in
   `app/interview/prompts.py`'s spoken system-instruction text ("After Question 6...", "Question 6
   is answered..."), which is never sent as a WebSocket payload. The only `"status"` message the
   server ever sends is the static `"Connected! Your video presentation session has started."` from
   `handler.py`. The regex has therefore never matched in production — confirmed dead, not just
   unused. Removed it; `"status"` now only does the (already-live) `setShowCheckIn(false)`.
2. **Server-driven progress via a new Gemini tool call — confirmed feasible, deliberately NOT
   implemented this sprint.** Making the model actually report progress requires a second Gemini
   Live function-declaration (alongside the existing `end_session` in
   `gemini_client.py`/`prompts.py`) AND an instruction in `SYSTEM_INSTRUCTION` telling the model to
   call it after each question — there is no way to get real per-question signal out of the model
   without adding that instruction line. This sprint's constraint is explicit: "Do NOT redesign the
   interview questions or prompt this sprint." Adding a new instruction to `SYSTEM_INSTRUCTION`,
   even one line, even behind a flag, is a prompt change, not a UI/wiring change — so it's out of
   scope regardless of the task description's ask. Skipping this half per the SPEC's own rule
   ("if it does not fit, note it in NOTES.md and skip it"), not silently. The `currentQuestion`/
   `totalQuestions` state and the "Question X of Y" UI text in `page.tsx` are left exactly as they
   were (harmless dead code — `currentQuestion` starts at 0 and is now never incremented, same
   effective behavior as before this fix, since the removed regex never incremented it either).
   Left as a named follow-up for a sprint where prompt changes are in scope.
3. **Timer color thresholds hardcoded — confirmed and fixed.** `page.tsx`'s `timerColor` used literal
   `timerSecs >= 270` / `>= 210` with no reference to `settings.max_interview_duration` (300s
   default) — the same value `handler.py` already enforces server-side as the real timeout. Fixed by:
   - Adding `maxDurationSecs: settings.max_interview_duration` to `POST /api/sessions`'s response
     (additive field, no breaking change to the existing `sessionId` shape).
   - `use-interview-call.ts`'s `createSession()` now reads `data.maxDurationSecs` into a new
     `maxDurationSecs` state (defaulted to 300 so nothing breaks if an older/mismatched backend
     omits the field), returned from the hook.
   - `page.tsx`'s `timerColor` now computes `timerSecs >= maxDurationSecs * 0.9` (red) /
     `* 0.7` (yellow) instead of the magic numbers — with the 300s default this evaluates to the
     exact same 270/210 thresholds as before, so behavior is unchanged unless the configured
     duration actually differs from the default.

- **Verification:**
  - Backend: added `tests/test_session_routes.py::test_create_session_returns_configured_max_duration`
    asserting the new field equals `settings.max_interview_duration`. Full suite before and after:
    **24 passed** (23 + 1 new), no regressions.
  - Frontend: `npx tsc --noEmit` — zero new errors in touched files (same pre-existing, unrelated
    errors in `app/admin/applicant/[id]/page.tsx` and `app/apply/form/page.tsx` as before this
    change). `npx next build` — compiles, same route shapes.
  - No new frontend unit test added for the threshold-percentage arithmetic: same no-test-runner
    carve-out as B11 (nothing new to add to that gap — still tracked under A9).
  - Explicitly NOT done this sprint (see finding 2): the actual server-sent `{type: "progress",
    question: N}` message and its backing Gemini tool call, because it requires a prompt change.

### B13: Single source of truth for interview duration

Confirmed by reading the code, then fixed. Task description: "One setting for duration injected
into prompt and client via initial config message; remove hardcoded 270s/5-6min drift." Unlike
B12's new tool call, this task is a value substitution — an existing hardcoded number already in
the prompt gets replaced by the configured one — not new model behavior, so it does not fall under
"do not redesign the prompt."

1. **Prompt text drift (backend, the literal "5-6 minutes" this task names).**
   `app/interview/prompts.py`'s `SYSTEM_INSTRUCTION` had `PHASE 1 — FORMAL PRESENTATION (5-6
   minutes, 6 questions)` as a static string, while the actual hard cutoff enforced by
   `handler.py`'s `asyncio.wait_for(..., timeout=settings.max_interview_duration)` is 300s = 5
   minutes. A model pacing itself to "5-6 minutes" against a 5-minute hard stop is exactly the kind
   of drift this task calls out. Turned `SYSTEM_INSTRUCTION` into `build_system_instruction(
   max_duration_seconds)`, which renders `(~{N} minutes total, 6 questions)` from
   `settings.max_interview_duration`. `gemini_client.py`'s `build_live_connect_config()` now calls
   `build_system_instruction(settings.max_interview_duration)` instead of importing the static
   string. No other file imported `SYSTEM_INSTRUCTION` (grepped to confirm).
2. **Client duration source (backend + frontend, "injected into client via initial config
   message").** B12 already added `maxDurationSecs` to the one-time `POST /api/sessions` HTTP
   response. That's fine for the initial load but doesn't help a future reconnect (B10, still
   pending) which won't re-run session creation. Added the same value to the WebSocket's initial
   `"status"` message (`handler.py`, the "Connected!..." message sent right after the Gemini Live
   session opens) — the channel the task description actually points at. `use-interview-call.ts`'s
   `"status"` branch now also reads `msg.maxDurationSecs` and updates the same state B12 introduced.
   Both delivery paths read from the one config value (`settings.max_interview_duration`), so
   there's nothing to drift between them.
3. **Remaining hardcoded "~5 minutes" copy (frontend).** Grepped for other occurrences of this
   number: `app/apply/interview/page.tsx`'s subheading ("The interview takes approximately 5
   minutes") had the same hook state (`maxDurationSecs`) available already, so made it
   `Math.round(maxDurationSecs / 60)` — same wording, no longer a magic number.
   `components/form-tabs/ai-interview.tsx` has the same sentence but is rendered *before* any
   session exists (the pre-application tab), with no session/websocket to source a duration from —
   adding a config-fetch endpoint just for this one marketing line is out of scope for "single
   source of truth for interview *duration*" (it's about eliminating drift between the enforced
   duration and what the model/timer are told, not about wiring config into every page that
   mentions "5 minutes"). Left as-is; noted here rather than silently skipped.

- **Verification:**
  - Backend: added `tests/test_prompts.py` (asserts `build_system_instruction(300)` renders "~5
    minutes total" and not the old "5-6 minutes" string; asserts it recomputes for a different
    duration) and `test_websocket.py::test_websocket_initial_status_message_carries_configured_max_duration`
    (asserts the live "status" message's `maxDurationSecs` equals `settings.max_interview_duration`).
    Full suite before and after: **26 passed** (24 + 2 new), no regressions.
  - Frontend: `npx tsc --noEmit` — zero new errors in touched files (same pre-existing baseline).
    `npx next build` — compiles, same route shapes.

### B10: Reconnection and network loss handling

Confirmed by reading the code, then fixed. Task description: "handle a dropped network mid-
interview." Read `handler.py` and `use-interview-call.ts` end to end first to see what B6/B7
already covered vs. what was actually missing.

1. **Already handled (B6/B7, pre-existing).** A disconnect mid-interview already lands in
   `_run_interview_session`'s `except WebSocketDisconnect` branch, which calls
   `mark_incomplete()` — the transcript-so-far is saved and the session status becomes
   `"incomplete"`. So a drop never silently loses data; it just had no path back into a live
   call. That's the actual gap this task is about.
2. **Gap 1 (frontend): no reconnect attempt at all.** `use-interview-call.ts`'s `ws.onclose`
   treated every non-terminal close as fatal — one network blip ended the interview outright,
   even though the server-side session was still `"incomplete"` and resumable. Added
   `createSocket()`/`attachSocketHandlers()` (extracted from the old inline `onopen`/
   `onmessage`/`onclose` setup) so a reconnect can reuse the same handler wiring, and a bounded
   exponential-backoff retry (3 attempts, 1s/2s/4s) in `onclose` for exactly the case that used
   to be treated as fatal: an unexpected close **after** the interview was genuinely active
   (`mediaReadyRef`). First-connection failures and server-classified terminal errors (which
   already set `status: "error"` via an explicit `"error"` message before the close fires) are
   unchanged — the gate is specifically "was this session running, then dropped," not "did any
   close event happen." New `"reconnecting"` `CallStatus` drives new UI states in
   `apply/interview/page.tsx` (status pill, a dedicated alert, REC badge/timer kept visible).
   Local media capture needed no changes: the AudioWorklet's `port.onmessage` reads
   `wsRef.current` fresh on every audio frame, and `createSocket()` reassigns that ref on each
   reconnect, so audio streaming and the on-device `MediaRecorder` recording continue through a
   blip untouched.
3. **Gap 2 (backend): a reconnect opened a brand-new Gemini Live session with zero memory of
   the dropped one.** Even once the frontend could reconnect, the new WS connection called
   `_run_interview_session` from scratch, which opened a fresh `client.aio.live.connect(...)`
   with the same static system prompt — the model would restart the greeting/Phase 0 and re-ask
   already-answered questions, from the applicant's perspective a broken interview even though
   the transcript byte-for-byte survived. Added `build_resume_summary()` (`handler.py`): before
   opening the Gemini connection, look up the session's already-saved transcript (populated by
   `mark_incomplete` on the prior disconnect); if non-empty, condense it (tail-truncated to
   1500 chars) and thread it through `build_live_connect_config(resume_context)` ->
   `build_system_instruction(max_duration_seconds, resume_context)`, which appends a
   "RECONNECTION CONTEXT" block telling the model to acknowledge the interruption and continue
   rather than restart. For a brand-new session `existing.transcript` is `None`, so
   `resume_context` is `None` and the rendered prompt is byte-for-byte identical to before this
   change — the non-resume path is untouched, consistent with "behavior-preserving" and with
   this being a value/data injection into an existing prompt-builder, not a prompt redesign
   (same category as B13's precedent). The transcript list built in `_run_interview_session` is
   also now seeded from the existing DB transcript, so the final saved transcript spans both
   connections in order, not just the post-reconnect half.

- **Verification:**
  - Backend: extended `tests/fakes/gemini.py`'s `make_fake_genai_client` to accept a list of
    `FakeLiveSession`s (one per successive `connect()` call, needed so a reconnect test gets a
    genuinely fresh session instead of replaying the first one's exhausted script) and to record
    every `connect(**kwargs)` call for assertions. Added `test_build_resume_summary` (pure-
    function unit test: empty transcript -> `None`; short transcript renders both roles;
    over-length transcript truncates to exactly `RESUME_SUMMARY_MAX_CHARS + 1` chars) and
    `test_websocket_reconnect_seeds_new_gemini_session_with_transcript_recap` (full integration:
    first WS connection closes mid-interview, session becomes `"incomplete"`; second WS
    connection to the same `session_id` completes the interview; asserts the final transcript
    contains both connections' user turns in order, `connect_calls` has length 2, the first
    connect's system instruction does NOT contain "RECONNECTION CONTEXT", and the second's DOES
    and includes the pre-reconnect turn's text). Full suite before and after: **28 passed**
    (26 + 2 new), no regressions.
  - Frontend: `npx tsc --noEmit` — zero new errors in touched files. `npx next build` —
    compiles, all 11 routes generated, no errors.
  - Not covered by an automated test (browser-only, matches the sprint's stated CI carve-out):
    the actual `WebSocket` reconnect timing/backoff behavior in `use-interview-call.ts`. The
    resume-context half (the part that can silently break the interview if it regresses) is
    fully covered by the backend integration test above.

### B5: Recording-relative timestamp calibration

Confirmed by reading the code (and an Explore-agent sweep to trace the full consumer chain)
before fixing. Task description: transcript timestamps should be relative to the actual
recording, not to an unrelated server clock.

1. **The bug.** `handler.py`'s `session_start` is captured immediately after the client
   connects, but *before* `client.aio.live.connect(...)` — a real network round-trip to
   Gemini. `append_turn_text` computes every transcript entry's `timestamp` as
   `(now - session_start).total_seconds()`. Those timestamps are consumed by
   `app/ml/ai_detection.py`'s `_build_user_text()` to derive `timestamp_start`/`timestamp_end`
   for flagged segments, which the admin UI (`admin/applicant/[id]/page.tsx`) uses to seek an
   inline `<video>` player (`inlineVideoRef.current.currentTime = seg.timestamp_start`). But the
   client's actual on-device recording (`MediaRecorder`) only starts later, inside `ws.onopen`,
   after `getUserMedia` + `AudioContext`/`AudioWorklet` setup — a separate, later clock. Net
   effect: the admin video-seek feature consistently seeks ahead of where the applicant's speech
   actually occurs in the recording, by however long the Gemini handshake + client setup took.
2. **The fix.** Added a client->server control message, `{"type": "recording_started"}`, sent
   the instant `mr.start(1000)` fires in `use-interview-call.ts` — the true moment on-device
   recording begins. On the backend, `forward_to_gemini()` previously consumed
   `websocket.iter_bytes()`, which only understands binary frames and would raise on a text
   frame; rewrote it to a manual `while True: message = await websocket.receive()` loop that
   branches on `"websocket.disconnect"` (break — see note below), `message["bytes"]` (forward to
   Gemini exactly as before), and `message["text"]` (parse as JSON; on `"recording_started"`,
   the *first* time only, re-anchor `session_start = datetime.now(timezone.utc)`). Every
   timestamp computed after that point is relative to when recording actually started, not to
   the earlier, handshake-inflated moment.
   - Confirmed via Starlette source (`websockets.py`) that `iter_bytes()` itself swallows
     `WebSocketDisconnect` internally and just stops iterating — it never propagates the
     exception to the caller. So the old code's `except WebSocketDisconnect` around
     `iter_bytes()` was already dead/unreachable. The rewrite's `break` on
     `"websocket.disconnect"` matches that same silent-stop behavior exactly, rather than
     introducing a new log line on a path that never fired before — kept behavior-preserving on
     disconnect rather than "fixing" a latent quirk as a drive-by.
3. **Known limitation, flagged rather than silently left.** This calibration only covers the
   *first* WebSocket connection. On a B10 reconnect, `_run_interview_session` runs again with a
   fresh, uncalibrated `session_start`, and the frontend does not resend `"recording_started"`
   on reconnect (gated by `mediaReadyRef.current` already being `true`, since local capture is
   not torn down across a reconnect). Post-reconnect transcript timestamps therefore revert to
   being measured against the reconnect's own handshake-inflated `session_start`. Scoped out of
   B5: it's a reconnect-continuity concern that more naturally belongs with B10 (which already
   shipped without addressing it), and fixing it here would mean re-deriving "recording start"
   from something other than a fresh client message, which risks scope creep beyond this task's
   bug fix.

- **Verification:**
  - Backend: extended `tests/fakes/gemini.py`'s `FakeLiveSession` with `initial_delay` (a real
    `asyncio.sleep` before the first scripted response is yielded), added
    `test_websocket_recording_started_recalibrates_transcript_timestamps` — connects, sleeps
    0.35s (stand-in for client-side setup time) before sending `"recording_started"`, then waits
    for a response the fake session delays by 0.6s. Uncalibrated, the resulting transcript
    entry's timestamp would land near the full 0.6s (measured from the original, pre-handshake
    `session_start`); recalibrated, it lands near `0.6 - 0.35 = 0.25s` — asserted `< 0.45s`, a
    threshold comfortably between the two to catch a regression without being flaky on
    scheduling jitter. Full suite before and after: **29 passed** (28 + 1 new), no regressions.
  - Frontend: `npx tsc --noEmit` — zero new errors in touched files. `npx next build` —
    compiles, all 11 routes generated, no errors.
  - Not covered by an automated test: the real-world magnitude of the drift this fixes (actual
    Gemini handshake latency, actual browser `getUserMedia` timing) — those only exist outside
    a test harness. The test above proves the calibration mechanism re-anchors timestamps
    correctly given a simulated delay, which is the part that can regress silently in code.

### A5 — Repository/service boundaries + `app/domain/` shared types

1. **`app/domain/enums.py` (new).** `SessionStatus` and `Recommendation` are now `str, Enum`
   classes matching the existing raw string values exactly (`in_progress`/`completed`/
   `incomplete`; `strongly_recommended`/`recommended`/`needs_review`/`not_recommended`). Every
   assignment site uses `.value` explicitly (e.g. `SessionStatus.COMPLETED.value`) rather than
   the bare enum member — `str(EnumMember)` can print `"ClassName.MEMBER"` instead of the raw
   value on some serialization paths, and `.value` sidesteps that ambiguity entirely, keeping
   the on-disk/serialized string byte-for-byte identical to before.
   - `Recommendation` is wired only into `app/interview/handler.py`'s `VALID_RECOMMENDATIONS`
     validation set. Deliberately **not** wired into the ~10 `app/ml/*` scoring/fairness/triage/
     evaluation files that also use raw recommendation strings — that's scoring-adjacent and
     explicitly out of this sprint's scope ("Do NOT build new scoring"), and touching it offers
     no bug-fix value while carrying real regression risk for zero benefit.
2. **`TranscriptEntry` (new, in `app/domain/entities.py`), narrowly scoped.** Used only as the
   request-body type for `POST /api/sessions/{session_id}/analyze` — confirmed via grep that
   this route has zero frontend callers (the admin UI's AI-detection button calls `/detect-ai`,
   not `/analyze`), making it a safe, low-risk boundary to introduce a typed model at.
   Deliberately did **not** retype `Session.transcript` / `SessionResponse.transcript` (still
   `Optional[List[dict]]`): traced every consumer outside `handler.py` (`session_routes.py`,
   `admin_routes.py`, `validation_routes.py`, `enhanced_analysis.py`, `user_use_cases.py`,
   `repositories.py`) and several do raw dict access (`entry["role"]`, `.get(...)`) that would
   break immediately if transcript entries became Pydantic model instances — retyping the field
   itself would ripple far beyond this task's safe scope.
3. **`session_routes.py`: no route handler instantiates `SessionRepository`/`UserRepository`
   directly anymore.**
   - Two new use cases, `SubmitApplicationUseCase` and `StartSessionUseCase`
     (`app/use_cases/session_use_cases.py`), back `/api/applications` and `/api/sessions`. Each
     returns a `(result, error, status_code)` triplet — a new, additive convention alongside the
     existing `(result, error)` pair used by `GetSessionUseCase`/`UploadRecordingUseCase` —
     needed because these two routes preserve multiple distinct HTTP status codes (400/404/409)
     that inline route code used to return directly.
   - `upload_recording`'s ownership pre-check, `get_recording_url`, and `detect_ai_in_session`
     now all fetch the session via the pre-existing `GetSessionUseCase` instead of a direct
     `SessionRepository` call, with zero changes to `GetSessionUseCase` itself.
   - `upload_recording`'s own `UploadRecordingUseCase` was left untouched (still takes
     `session_id, file_content, filename` and doesn't check ownership itself) — the ownership
     check was moved to a *separate*, earlier `GetSessionUseCase` call in the route, preserving
     the exact original error-precedence order (404/403 ownership, then 400/400 content-type/
     size, then the upload).
   - Both new use cases compose the pre-existing `CreateSessionUseCase` internally rather than
     calling `session_repo.create()` directly, so it isn't left orphaned.
   - `serve_local_upload` and `get_recording` were left completely unchanged — the former's
     unused `db_session` dependency predates this task (confirmed via `git log -p`/blame
     equivalent reading), and the latter already used `GetSessionUseCase` before this task
     touched anything.
4. **Confirmed no silent breakage from the `SessionStatus` enum.** `grep -n
   "\"completed\"\|\"incomplete\"\|\"in_progress\""` across `admin_routes.py`,
   `enhanced_analysis.py`, and `validation_routes.py` returned nothing — none of them do raw
   status-string literal comparisons that the enum's introduction could silently break.
5. **Dead code spotted, not removed here.** `CompleteSessionUseCase`
   (`session_use_cases.py`) has zero call sites anywhere in the codebase. Left as-is and flagged
   for the A9 dead-code triage list rather than deleted as a drive-by in a task that's supposed
   to be about boundaries, not cleanup.
6. **Test-infra fix (no production behavior change): rate limiter leaking state across tests.**
   Adding new tests that call `/api/register` (below) exposed a latent test-isolation gap: the
   `/api/register`/`/api/login` slowapi `Limiter` in `app/api/user_routes.py` is a process-wide
   in-memory singleton keyed by client IP, and every test client resolves to the same address.
   With enough register calls across the whole run, later test files started failing with 429s
   that had nothing to do with what they were testing. Fixed by adding an autouse
   `_reset_rate_limits` fixture in `tests/conftest.py` that calls `limiter.reset()` before every
   test — this touches no production code path, only test isolation.

- **Verification:**
  - Backend: added regression tests in `tests/test_session_routes.py` for branches that used to
    be inline in the route and are now inside the new use cases —
    `test_create_session_requires_user_id`, `test_create_session_requires_program`,
    `test_create_session_rejects_unknown_user`,
    `test_create_session_rejects_duplicate_after_completion` (409 path),
    `test_submit_application_merges_into_existing_session` (existing-session merge into
    `applicant_data`), `test_submit_application_requires_user_id`. Full suite before and after:
    **29 passed → 35 passed** (29 + 6 new), no regressions, once the rate-limiter test-isolation
    fix above was in place (without it, unrelated tests later in the run started flaking on
    429s purely from register-call volume, not from anything this task changed).
  - Frontend: untouched by this task (backend-only refactor); not re-verified since no frontend
    file was edited.

### A6 — Scoring module seam (`ScorerInterface`) + wiring-only fixes

1. **Duplicated ml-scoring wiring found at 3 call sites.** `admin_routes.py`'s
   `admin_triage_queue`, `demo_routes.py`'s `demo_analyze`, and
   `enhanced_analysis.py`'s `EnhancedAnalysisUseCase.execute` each called the same 6 functions
   (`compute_data_quality_score`, `baseline_score_applicant`, `agreement_score`,
   `detect_evaluation_inconsistencies`, `identify_edge_cases`, `compute_authenticity_score`) with
   identical arguments and order. Confirmed via grep that none of the six mutate their inputs
   (every `.append()` targets a locally-created list), so consolidating the call order/location
   into one seam is behavior-preserving — no scoring algorithm was touched, satisfying "Do NOT
   build new scoring."
2. **`ScorerInterface` (new, in `app/domain/interfaces.py`).** A synchronous
   `score_core(applicant_data, transcript, evaluation) -> dict` ABC method, following the same
   ABC pattern as `UserRepositoryInterface`/`SessionRepositoryInterface` in the same file.
   Deliberately synchronous (unlike those two) because the underlying ml functions are plain sync
   calls — making it `async` would add no value and just force callers to `await` something that
   never suspends.
3. **`CoreScorer` (new, `app/ml/scorer.py`).** Calls the same 6 functions in the same order,
   returning a canonical dict (`data_quality`, `baseline`, `agreement`, `inconsistencies`,
   `edge_cases`, `authenticity`). These key names were chosen to match `admin_routes.py`'s
   existing flat output dict 1:1; `demo_routes.py`/`enhanced_analysis.py` (which use
   `baseline_evaluation` and a nested `error_analysis: {inconsistencies, edge_cases}` shape)
   remap explicitly at their call sites so their exact existing JSON response shapes are
   unchanged.
4. **Three call sites refactored to the seam, zero response-shape changes.**
   `admin_triage_queue`, `demo_analyze`, and `EnhancedAnalysisUseCase.execute` (which now takes a
   `scorer: ScorerInterface` constructor parameter, wired up in `validation_routes.py`'s
   `_get_enhanced_analysis_use_case` via `CoreScorer()`) all call
   `scorer.score_core(applicant_data, transcript, evaluation)` once and destructure the 6 keys
   instead of calling the functions inline. `demo_baseline` was left untouched — it's a single
   `baseline_score_applicant` call, not duplicated wiring, so it's out of scope for the seam.
5. **Small wiring-only fix: `admin_routes.py`'s hardcoded `valid_recs` literal.**
   `admin_override_evaluation` had `{"strongly_recommended", "recommended", "needs_review",
   "not_recommended"}` as a literal, duplicating the values already canonicalized in A5's
   `Recommendation` enum (a gap A5's own verification grep missed, since that grep only checked
   for status strings, not recommendation strings). Replaced with `{r.value for r in
   Recommendation}`, matching the pattern already used in `app/interview/handler.py`'s
   `VALID_RECOMMENDATIONS`.
6. **Zero existing coverage found for the routes this task touches.** `admin_triage_queue`,
   `demo_analyze`, and every `validation_routes.py` endpoint had no tests before this task
   (confirmed via grep). Added `tests/test_scoring.py`: a unit test of `CoreScorer.score_core()`
   (both with sample data and with all-`None` inputs), an HTTP test of `/api/demo/analyze`
   asserting its nested `error_analysis`/`baseline_evaluation` response shape survived the
   refactor, and an HTTP test of `/api/admin/triage` (using the `settings.admin_creation_secret`
   monkeypatch + create-admin + login pattern already established in `test_websocket.py`)
   asserting a scored session shows up in the tiered `queue` response.

- **Verification:**
  - Backend: full suite before and after: **35 passed → 39 passed** (35 + 4 new in
    `tests/test_scoring.py`), no regressions.
  - Frontend: untouched by this task (backend-only refactor); not re-verified since no frontend
    file was edited.

### A8 — Feature flags module (backend + frontend), all off by default

1. **No SPEC text or prior precedent for this task beyond its title.** Confirmed via grep that no
   dedicated SPEC file exists in the repo — the task list is a chat-only spec. Confirmed via
   `NOTES.md` grep that there's no earlier feature-flags scaffolding to build on. Scope taken
   literally: a minimal, symmetric on/off lookup, backend and frontend, defaulting to fully off.
2. **Backend: `Settings.feature_flags` (new field), not raw `os.environ`.** `app/config.py`'s
   `Settings` is a pydantic-settings `BaseSettings` with `model_config = {"env_file": ".env", ...}`
   — its `.env`-file loading does **not** mutate `os.environ`, so a naive
   `os.environ.get("FEATURE_FLAGS")` call would silently miss any flag set only in a local `.env`
   file, inconsistent with every other config value in the app. Instead added
   `feature_flags: str = ""` (comma-separated enabled-flag-names) directly to `Settings`, matching
   how every other env-driven value in this app is read (A3's config-hygiene pattern).
3. **`app/core/feature_flags.py` (new).** One function, `is_enabled(flag_name: str) -> bool`,
   built on `settings.feature_flags`. Lookup is case- and whitespace-insensitive; no flag names
   are hardcoded in the module — callers supply whatever name they choose. Empty string (the
   default in every environment) means every flag is off.
4. **Frontend: `lib/feature-flags.ts` (new), symmetric design.** `isFeatureEnabled(flagName)`
   reads a comma-separated `NEXT_PUBLIC_FEATURE_FLAGS` env var (Next.js requires the
   `NEXT_PUBLIC_` prefix for a var to reach client code, following the same convention as
   `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL` already in `.env.example`), same case/whitespace
   normalization as the backend. Not wired into any page/component this task — the task is the
   module itself, not adopting it anywhere, since "Do NOT redesign the interview questions or
   prompt this sprint" rules out gating existing UI behind a new flag speculatively.
5. **No frontend unit test added, for the same already-flagged reason as B12/B8/B9/B11/B13/B10.**
   `isFeatureEnabled` is pure, extractable logic, but this repo still has no test runner (no
   jest/vitest/ts-node in `frontend/package.json`, no test script, confirmed again via full read of
   the file). Adding one for a single pure function would be a disproportionate infra change for
   this sprint's scope. Flagged as a real gap, not silently skipped — worth revisiting if/when a
   frontend test runner is added (see A9 dead-code/tooling triage).
6. **Both `.env.example` files updated.** `backend/.env.example` gets `FEATURE_FLAGS=` (empty,
   matching `ADMIN_CREATION_SECRET=`'s style) with an explanatory comment; `frontend/.env.example`
   gets `NEXT_PUBLIC_FEATURE_FLAGS=` likewise.

- **Verification:**
  - Backend: `tests/test_feature_flags.py` (4 new tests: off-by-default, enabling multiple flags,
    case/whitespace insensitivity, empty-entries-ignored) — full suite before and after: **39
    passed → 43 passed**, no regressions.
  - Frontend: `pnpm exec tsc --noEmit` — zero new errors (same 2 pre-existing, unrelated errors as
    every prior segment's baseline: `app/admin/applicant/[id]/page.tsx:1210` and
    `app/apply/form/page.tsx:49,60`); confirmed `lib/feature-flags.ts` itself produces no errors.
    No frontend unit test added — see finding 5 above.

### A9 — Dead code triage list

Scope: **catalog only, no deletions this sprint.** Removing any of these would be a plausibly
behavior-preserving change, but verifying "zero call sites" with full confidence (rather than
"zero call sites found by grep") is exactly the kind of judgment call that's cheap to get wrong
under a "behavior-preserving refactors only" mandate — so these are flagged for a deliberate,
separate cleanup pass rather than removed inline here. Found by grepping every use-case class,
`app/ml/`/`app/core/` function, and frontend `lib/`/`hooks/` export for call sites outside their
own definition and tests.

1. **`CompleteSessionUseCase`** (`backend/app/use_cases/session_use_cases.py:146-151`) — never
   instantiated anywhere in the app (grep for `CompleteSessionUseCase` across `backend/` returns
   only its own definition). Note: the repository method it wraps,
   `SessionRepositoryInterface.complete()`, is *not* dead — `app/interview/handler.py:295` calls
   `repo.complete(session_id)` directly, bypassing the use case entirely. So it's the use-case
   wrapper that's dead, not the underlying capability. Discovered originally during A5.
2. **`backend/app/core/anonymization.py`** (whole file, 3 functions: `anonymize_text`,
   `anonymize_transcript`, `anonymize_applicant_data`) — the entire module is orphaned; nothing in
   `backend/` imports it (grep for `anonymiz` returns only hits inside the file itself). Its
   presence is explained by `backend/IMPROVEMENTS_PLAN.md:138`, which lists it as a planned "PII
   handling" module that was apparently scaffolded but never wired into the session/transcript save
   path. Candidate for either wiring up for real or removing — not this sprint's call.
3. **`frontend/lib/api.ts:16-27` — `getStoredUser()`** — exported, never imported anywhere in
   `frontend/` (grep for `getStoredUser` outside its own file returns nothing).
4. **`frontend/lib/api.ts:53-67` — `fetchApiRaw()`** — exported, never imported anywhere (same
   check, no hits outside its own file).
5. **`frontend/lib/auth.ts:39-55` — `getTimeUntilExpiry()`** — exported, never imported anywhere
   outside its own file.

Not included: this sprint's own `isFeatureEnabled()` (A8) — unused today by design (a
just-added module meant to be adopted later), not dead code in the same sense as the above.

### B14 — Rate limits/abuse controls on the live interview path

1. **Initial hypothesis investigated and found NOT to be a bug — per the "confirm before fixing"
   rule, skipped rather than "fixed."** `app/main.py` builds its own `Limiter` instance (line 23)
   and assigns it to `app.state.limiter`, but the actual rate-limited routes
   (`/api/register` 10/min, `/api/login` 5/min in `app/api/user_routes.py`) use a *second*,
   separate `Limiter` instance defined in that file — `app.state.limiter` is never read by
   anything. No `RateLimitExceeded` exception handler or `SlowAPIMiddleware` is registered
   anywhere. This looked like it would make a rate-limit trip surface as an unhandled 500 instead
   of a 429. **Disproved by reading slowapi's source** (`RateLimitExceeded` subclasses
   `HTTPException` with `status_code=429`, and Starlette's default exception-handling middleware
   handles any `HTTPException` automatically, no custom handler required) **and by direct
   reproduction** (a throwaway pytest hitting `/api/login` 6 times in a row; the 6th correctly
   returned `429 {"detail":"5 per 1 minute"}`, not 500). No fix applied; repro files deleted.
2. **The real, confirmed-by-reading gap: nothing throttles live-interview websocket
   reconnects.** `POST /api/sessions`, `POST /api/applications`, and the `/ws/{session_id}`
   connect handshake all have zero rate limiting. The websocket gap is the one that matters
   cost-wise: `app/interview/handler.py`'s own B10 comment on `build_resume_summary` says a
   reconnect "opens a brand-new Gemini Live session with no memory of the dropped one" — so
   before this fix, a client (or an abusive script) could reconnect to the same `session_id` in a
   tight loop and open an unbounded number of billable Gemini Live sessions. B3's existing
   `_active_connections` guard doesn't help here — it only blocks *concurrent* connections to one
   session, not rapid sequential connect/disconnect/reconnect cycling.
3. **Fix: a per-session connect-attempt throttle in `handler.py`, not a broader/global rate
   limiter.** Added `_connect_attempts: dict[str, list[float]]` and
   `_record_connect_attempt(session_id) -> bool`, sliding-window (default 8 attempts per 600s,
   both new `Settings` fields: `max_connect_attempts_per_session`,
   `connect_attempt_window_seconds`), checked at the top of `run_interview_session` before the
   existing B3 concurrency check. Scoped this narrowly — one `session_id`-keyed in-memory guard,
   same single-worker/race-free assumptions as B3's own `_active_connections` — rather than a
   per-user or global HTTP rate limiter, since this directly targets the actual cost driver
   (Gemini session creation) with minimal new surface area, and mirrors a pattern this file
   already establishes. Over-limit attempts get a clear `error` message and a new close code,
   `4029` (following this file's existing 4000s-range custom-close-code convention —
   `4029` deliberately echoes HTTP 429).
4. **`_connect_attempts`'s memory footprint is bounded by session count, not pruned on a
   timer.** Every `session_id` ever connected to keeps a small entry (≤ `MAX_CONNECT_ATTEMPTS`
   timestamps) for the life of the process — bounded by how many interview sessions exist
   (same order of magnitude as the sessions table itself), not by connection-attempt volume.
   Judged acceptable for the same reason the in-memory `_active_connections` set already is.

- **Verification:**
  - `tests/test_websocket.py`: 3 new tests — `test_record_connect_attempt_blocks_after_max_within_window`
    and `test_record_connect_attempt_ignores_attempts_outside_window` (pure-logic, monkeypatched
    globals) plus `test_websocket_rejects_connect_attempt_over_the_limit` (full integration:
    connect, close, reconnect, assert the 2nd connect gets the throttle error). The integration
    test closes the first connection and polls the admin endpoint for cleanup to finish *before*
    exiting the `with` block, same reason `_poll_session_status` exists — reconnecting immediately
    after the block exits races the first connection's server-side teardown against the second
    connection's own DB access and intermittently corrupts the shared in-memory sqlite connection.
  - Full suite before and after: **43 passed → 46 passed**, no regressions.

## Known pre-existing failures (not caused by this sprint, not in scope)

- `frontend` has no `eslint` (or `eslint-config-next`) in `devDependencies`, even though
  `package.json` defines `"lint": "eslint ."`. Running it fails with `eslint: command not
  found`. This predates this sprint and is unrelated to the live-call feature; not fixed here
  since the spec is behavior-preserving bug fixes on the interview feature, not a general
  frontend dependency audit. CI still runs the script so this becomes visibly red instead of
  silently never-checked.
- `pnpm exec tsc --noEmit` currently reports 2 real type errors, both outside the interview
  feature: `app/admin/applicant/[id]/page.tsx:1210` (a `<Progress className=...>` prop that
  doesn't exist on that component's type) and `app/apply/form/page.tsx:49,60` (`FormErrors`
  type used but not imported/declared). Left as-is for the same reason as above; flagging here
  so they don't get confused with anything introduced by this sprint.

## Skipped

Per the SPEC's "reproduce or confirm before fixing; if it doesn't reproduce/fit, note it here and
skip it" rule — these were investigated and deliberately not changed, with the reason:

1. **B12 — real per-question progress signal from the model.** Confirmed the only way to get
   genuine per-question progress out of Gemini Live is a new function-declaration plus an added
   line in `SYSTEM_INSTRUCTION` telling the model to call it — i.e. a prompt change, which this
   sprint's constraint ("Do NOT redesign the interview questions or prompt this sprint") rules out
   regardless of how small. Everything else in B12's scope (real duration wiring, timer UI) was
   fixed; this one piece is a named follow-up for a sprint where prompt changes are allowed. See
   B12 above.
2. **B9 — playback queue burst/catch-up scheduling.** Read `playPCM`'s scheduling math
   (`Math.max(ctx.currentTime, nextPlayAtRef.current)`) and confirmed it already handles both
   burst arrival and falling behind correctly. No bug found, so nothing changed. See B9 above.
3. **B14 — suspected missing 429-vs-500 handling on existing slowapi rate limits.** Hypothesized
   `app/main.py`'s unused `Limiter`/missing `RateLimitExceeded` handler meant a rate-limit trip on
   `/api/login` or `/api/register` returned an unhandled 500. Disproved by reading slowapi's
   source (`RateLimitExceeded` is an `HTTPException` subclass, handled automatically by Starlette
   with no custom handler needed) and by direct reproduction (6 rapid `/api/login` calls; the 6th
   correctly returned 429). No fix applied. See B14 above.
4. **A9 — the 5 cataloged dead-code items.** Deliberately not deleted this sprint (catalog only);
   see A9 above for the full list and reasoning (mainly: "zero call sites per grep" isn't the same
   confidence level as "zero call sites, verified," and this sprint's mandate is
   behavior-preserving, not a cleanup pass).

## Remaining

Real gaps identified during this sprint but intentionally left for later work, because fixing them
would exceed this sprint's "behavior-preserving refactors + bug fixes, no new scoring, no prompt
changes" scope:

1. **No frontend test runner exists** (no jest/vitest/ts-node in `frontend/package.json`). Every
   frontend-logic fix this sprint (B8, B9, B11, B12, B13, A7, A8) was verified via `tsc --noEmit` +
   manual/read-through review instead of a unit test, per the SPEC's own allowance ("for frontend,
   a unit test of the extracted logic... browser audio cannot be tested in CI") — but that
   allowance assumes a runner exists to write the test *in*. Adding one (and backfilling tests for
   all the extracted hooks from A7) is the single highest-value follow-up for this codebase's test
   coverage.
2. **Real per-question progress from the model** (B12, see Skipped #1) — needs a new Gemini
   function-declaration + a `SYSTEM_INSTRUCTION` line; blocked on a sprint where prompt changes
   are in scope.
3. **A9's 5 dead-code items** — `CompleteSessionUseCase`, `backend/app/core/anonymization.py`
   (whole module), and 3 unused frontend `lib/` exports. Catalogued with file/line references;
   removing them is a good candidate for a dedicated small cleanup PR.
4. **`backend/app/core/anonymization.py` specifically** is scaffolded but never wired into the
   transcript/applicant-data save path (see `backend/IMPROVEMENTS_PLAN.md:138`) — worth a decision
   (wire it up for real PII handling, or delete it) rather than leaving it orphaned indefinitely.
5. **Pre-existing, unrelated-to-this-sprint issues, left as-is and documented above under "Known
   pre-existing failures":** missing frontend `eslint`/`eslint-config-next` dependency, and 2
   pre-existing `tsc` type errors outside the interview feature
   (`app/admin/applicant/[id]/page.tsx:1210`, `app/apply/form/page.tsx:49,60`).
6. **B14's throttle (and B3's `_active_connections` guard it sits next to) are in-memory,
   single-process state** — correct for this app's current single-uvicorn-worker deployment
   (documented in both), but would need to move to a shared store (e.g. Redis) before the app
   could safely run with more than one worker/instance. Not a bug today; a scaling constraint to
   revisit if the deployment topology changes.
7. **Token-in-URL on `/api/recording-url/{session_id}` and `/api/uploads/{file_path:path}`**
   (Section 0 checklist item 5, below) — the full-access 24h login JWT is passed as `?token=`
   because both routes are hit as plain URLs that can't carry an `Authorization` header. Fixing
   this properly needs a separate short-lived, single-purpose media token; out of scope for a
   checklist bugfix pass.

All 25 tasks in PART C's ordering (A1–A9, B1–B15) are done as of this entry; nothing was left
incomplete or silently dropped.

## SPEC: Scoring core and committee view

### Section 0 — security checklist (confirmed before starting P1–P4)

Per the new SPEC's mandatory first step, re-verified each of the 6 items against the actual
routes rather than trusting the prior sprint's NOTES.md claims above. Two items were still open
despite being logged as fixed; two more were exposed by code paths the checklist didn't name
directly. All are now fixed; see the commits that follow this entry for detail per item.

1. **IDOR on recordings — was OPEN, now FIXED.** B8 (earlier in this file) only added an
   ownership check to `POST /api/upload-recording`. `GET /api/recording/{session_id}` and
   `GET /api/recording-url/{session_id}` (`backend/app/api/session_routes.py`) had no ownership
   check at all — any authenticated user (`/recording`) or any holder of any valid JWT
   (`/recording-url`, which doesn't even use `get_current_user`) could read any other applicant's
   presigned recording URL by guessing/enumerating `session_id`. Fixed: both now require the
   caller to be the session's owner or an admin.
2. **IDOR on uploads — confirmed FIXED**, matches B8's claim. `POST /api/upload-recording`
   correctly checks `session_obj.user_id != current_user.id` (session_routes.py) before writing.
   No change needed.
3. **Path traversal — not named in the prior sprint, was OPEN, now FIXED.**
   `GET /api/uploads/{file_path:path}` built `Path("uploads") / file_path` and only checked
   `.exists()`/`.is_file()` — a `file_path` containing `../` segments was never rejected, and the
   route also had no ownership check (any valid JWT, from any user, granted access to any file).
   Fixed: resolve the path and reject anything that escapes the uploads base directory, and
   require the session embedded in the `recordings/{session_id}/{filename}` key to belong to the
   caller or an admin.
4. **`/users` access control — not named in the prior sprint, was OPEN, now FIXED.**
   `GET /api/users` and `GET /api/users/{user_id}` (`backend/app/api/user_routes.py`) required
   only `get_current_user` — no role or ownership check — so any authenticated applicant could
   list every other applicant's name/email/phone/session/evaluation, or fetch any one of them
   directly by id. (The admin-only equivalents at `/api/admin/users[/​{id}]` already existed and
   are unaffected.) Fixed: list now requires admin; detail now requires the caller be the target
   user or an admin.
5. **Token-in-URL — confirmed still OPEN, accepted as a scoped, documented tradeoff.**
   `/api/recording-url/{session_id}` and `/api/uploads/{file_path:path}` take the auth JWT as a
   `?token=` query param because both are hit as plain URLs (`<video src>`, redirect targets) that
   can't attach an `Authorization` header. This does mean the full-access 24h login token can end
   up in proxy/browser logs. Not redesigned in this pass (would need a separate short-lived,
   single-purpose media token, which is a real but separate feature, not a checklist-item bugfix)
   — but items 1 and 3 above now mean a leaked token alone is no longer sufficient to read
   *another* user's recording, only the leaker's own, which meaningfully shrinks the blast radius.
   Left as a follow-up under "Remaining" above (item 7).
6. **Rate limits — was PARTIALLY open, now FIXED.** `/api/login` (5/min) and `/api/register`
   (10/min) already had `slowapi` limits (B14 confirmed these work correctly). The Live websocket
   connect path already has B14's own in-process throttle. `POST /api/sessions` (session
   creation) had no limit at all. Fixed: added a 10/minute-per-IP limit, reusing the existing
   shared `Limiter` instance from `user_routes.py` rather than introducing a second one.
7. **Upload race conditions — confirmed FIXED**, matches B8's claim. `UploadRecordingUseCase`
   writes to the deterministic key `recordings/{session_id}/{filename}` and re-uploads overwrite
   in place; `test_upload_recording.py::test_concurrent_uploads_to_same_session_both_succeed`
   already covers this. No change needed.

Section 0 is complete: items 1, 3, 4, and 6 fixed (one commit each, each with a regression test);
items 2 and 7 confirmed already fixed with no change needed; item 5 accepted as a documented,
scoped tradeoff (see "Remaining" item 7 above). Full suite green (59 passed) after every commit.
Proceeding to P1 (T13–T18) next.

### P1 — Bias removal (checklist)

Per Section 1's principles ("background never enters a score," "fluency/grammar/vocabulary/
accent never enter competency scores," "no AI-text detection," "no face/voice-affect
analysis"), each vector below was independently reproduced/confirmed before being fixed —
one commit per item, one regression test per behavior change, per Section 4's method.

1. **Rubric doc scored family support and communication style — was OPEN, now FIXED.**
   `backend/docs/assessment_rubric.md` explicitly listed Q6 (family support) and
   "communication quality" (grammar/pacing/articulation) as criteria that move the score/
   band. Reframed those sections as context recorded for the committee, never scored.
   Commit `f304a62`.
2. **Live-interview prompt and analysis prompt could weight family support / communication
   style into the verdict — was OPEN, now FIXED.** `app/interview/prompts.py`
   (`build_system_instruction`, `build_end_session_tool`) and
   `analyze_session_use_case.py`'s `ANALYSIS_PROMPT` now explicitly instruct the model to
   record the Q6 answer and communication observations as plain fields only, forbidden from
   feeding `overall_score`/`recommendation`. Verified via a prompt-construction test
   asserting the forbidding instruction text is present (Gemini's actual behavior isn't
   unit-testable, so this locks the contract instead). Commit `96030f7`.
3. **AI-text detection was a live, callable signal — was OPEN, now FIXED.** Deleted
   `POST /api/sessions/{id}/detect-ai`, `app/ml/ai_detection.py` (Sapling integration), and
   the frontend's AI-detection panel/`api.detectAI` call site. Test: route returns 404; full
   suite still green. Commit `fbafe88`.
4. **Fluency/CEFR and communication/confidence/language fields reached decision-adjacent
   aggregators — was OPEN, now FIXED.** `app/ml/error_analysis.py`'s
   `detect_evaluation_inconsistencies`/`identify_edge_cases` and
   `app/ml/explainability.py`'s `explain_recommendation` read `applicant_data`'s
   `language_used`/`confidence_level`/`communication_quality` and turned them into
   triage-feeding edge-case flags (`non_english_interview`, `low_confidence_assessment`,
   `poor_communication`), an inconsistency type (`communication_score_mismatch`), and a
   "Communication quality: excellent/good/poor" factor shown as a reason for the
   recommendation. Fixed by removing the `applicant_data` parameter (and the bodies that
   read it) from all three functions entirely — not just unused, structurally incapable of
   reading those fields now — and updating every call site (`scorer.py`, `demo_routes.py`,
   `enhanced_analysis.py`). `app/ml/fairness.py` and `app/ml/evaluation.py` still read these
   fields for aggregate, cross-session bias-*detection* (parity checks, confidence
   calibration) — that's the audit tooling this SPEC exists to make possible, not a
   violation, so left unchanged. New tests in `tests/test_bias_removal.py` (3 tests) assert
   none of the three fixed functions can produce a fluency/background-derived signal. Full
   suite green (65 passed) after this change. Commit `f046861`.
5. **Face/voice-affect analysis — confirmed absent, no fix needed.** Verified via two
   independent methods: (a) keyword grep for affect/emotion/facial/video-analysis terms
   across `backend/app/ml`, `frontend/app`, `frontend/components`, `frontend/lib` — the only
   hits were unrelated survey-question copy using "affects"/"affected" as plain English
   verbs; (b) full read of `backend/requirements.txt` — no image/video/audio-ML dependency
   (no OpenCV, no DeepFace, no librosa) beyond `google-genai`, which is used only for the
   Live API's text/audio streaming, not affect scoring. Nothing to remove.
6. **This checklist** — written after item 5's confirmation, closing out P1. All 5 bias
   vectors above are now fixed or confirmed absent; full suite green (65 passed) throughout.

P1 is complete. Proceeding to P2 (scoring core — `motivation_university`, `leadership`,
`prior_experience` only, per the cut line) next.
