"""Regression test for the Alembic chain: applying every revision from scratch
must actually create the `users`/`sessions` tables. The original chain had an
empty baseline revision, so `alembic upgrade head` against a fresh database
failed with "no such table: sessions" on the very next revision.
"""

import os

from alembic.config import Config
from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import OperationalError

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_migration_chain_creates_schema_from_scratch():
    engine = create_engine("sqlite:///:memory:")
    config = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    config.set_main_option("script_location", os.path.join(BACKEND_DIR, "alembic"))
    script = ScriptDirectory.from_config(config)

    revisions = list(script.walk_revisions(base="base", head="head"))
    revisions.reverse()  # walk_revisions goes head -> base; we want oldest first

    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            for rev in revisions:
                module = script.get_revision(rev.revision).module
                try:
                    module.upgrade()
                except OperationalError as exc:
                    # SQLite has no "ALTER TABLE ... ALTER COLUMN" support, so the
                    # final `op.alter_column(..., nullable=False)` in the role-field
                    # revision fails here even though it's correct for the real
                    # target dialect (Postgres, per env.py/config.py). The add_column
                    # and UPDATE statements in that same revision already executed
                    # (Alembic runs statements eagerly) before this line raised, so
                    # the schema assertions below are unaffected.
                    if "alter" not in str(exc).lower():
                        raise
        # The connection auto-begins a transaction on first statement and never
        # commits it otherwise -- every DDL statement above would silently roll
        # back the moment `conn` closes, which is why every revision after the
        # first caught OperationalError (including this one) used to vanish
        # from the schema the assertions below observe.
        conn.commit()

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    assert {"users", "sessions", "rating_events"}.issubset(tables)

    user_columns = {c["name"] for c in inspector.get_columns("users")}
    assert user_columns == {"id", "name", "email", "phone", "password", "role", "created_at"}

    session_columns = {c["name"] for c in inspector.get_columns("sessions")}
    assert session_columns == {
        "id",
        "user_id",
        "program",
        "recording_url",
        "transcript",
        "applicant_data",
        "evaluation",
        "started_at",
        "completed_at",
        "created_at",
        "status",
    }

    rating_event_columns = {c["name"] for c in inspector.get_columns("rating_events")}
    assert rating_event_columns == {
        "id",
        "session_id",
        "indicator",
        "quote",
        "band",
        "rater_type",
        "rater_id",
        "status",
        "created_at",
    }
