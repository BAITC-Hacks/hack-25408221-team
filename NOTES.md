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

(none yet)

## Remaining

(filled in at the end of the sprint)
