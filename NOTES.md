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
