"""add_english_gate_tables

Revision ID: e4d1f2a3b4c5
Revises: c3f9a1d2e6b7
Create Date: 2026-09-27 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "e4d1f2a3b4c5"
down_revision: Union[str, None] = "c3f9a1d2e6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "applicants",
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("external_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("full_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("email", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("state", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("placement", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("placement_source", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_applicants_external_id"), "applicants", ["external_id"], unique=True)

    op.create_table(
        "ielts_checks",
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("applicant_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("trf_number", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("family_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("test_date", sa.Date(), nullable=False),
        sa.Column("module", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("listening", sa.Float(), nullable=False),
        sa.Column("reading", sa.Float(), nullable=False),
        sa.Column("writing", sa.Float(), nullable=False),
        sa.Column("speaking", sa.Float(), nullable=False),
        sa.Column("overall", sa.Float(), nullable=False),
        sa.Column("verdict", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("reason", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("verifier_record", sa.JSON(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("checked_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["applicant_id"], ["applicants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ielts_checks_applicant_id"), "ielts_checks", ["applicant_id"], unique=False)

    op.create_table(
        "items",
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("section", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("stage", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("cefr", sa.Integer(), nullable=False),
        sa.Column("content", sa.JSON(), nullable=True),
        sa.Column("key", sa.JSON(), nullable=True),
        sa.Column("media_path", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("exposure_count", sa.Integer(), nullable=False),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "test_sessions",
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("applicant_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("state", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("form", sa.JSON(), nullable=True),
        sa.Column("current_section", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("section_started_at", sa.JSON(), nullable=True),
        sa.Column("section_deadline", sa.JSON(), nullable=True),
        sa.Column("route", sa.JSON(), nullable=True),
        sa.Column("screen_token_seed", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("levels", sa.JSON(), nullable=True),
        sa.Column("flags", sa.JSON(), nullable=True),
        sa.Column("placement", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("integrity_score", sa.Integer(), nullable=False),
        sa.Column("integrity_level", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["applicant_id"], ["applicants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_test_sessions_applicant_id"), "test_sessions", ["applicant_id"], unique=False)

    op.create_table(
        "responses",
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("session_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("item_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("section", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("stage", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("answer", sa.JSON(), nullable=True),
        sa.Column("media_path", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("keystroke_log_path", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("correct", sa.Boolean(), nullable=True),
        sa.Column("grade", sa.JSON(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["test_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_responses_session_id"), "responses", ["session_id"], unique=False)

    op.create_table(
        "checkins",
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("session_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("gates", sa.JSON(), nullable=True),
        sa.Column("consent_at", sa.DateTime(), nullable=True),
        sa.Column("id_photo_path", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("selfie_path", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("room_scan_path", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["test_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_checkins_session_id"), "checkins", ["session_id"], unique=True)

    op.create_table(
        "proctor_events",
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("session_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("section", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("ts_client", sa.DateTime(), nullable=True),
        sa.Column("ts_server", sa.DateTime(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=True),
        sa.Column("evidence_path", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["test_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_proctor_events_session_id"), "proctor_events", ["session_id"], unique=False)

    op.create_table(
        "reviews",
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("session_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("ielts_check_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("reviewer", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("decision", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("note", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["ielts_check_id"], ["ielts_checks.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["test_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("reviews")
    op.drop_index(op.f("ix_proctor_events_session_id"), table_name="proctor_events")
    op.drop_table("proctor_events")
    op.drop_index(op.f("ix_checkins_session_id"), table_name="checkins")
    op.drop_table("checkins")
    op.drop_index(op.f("ix_responses_session_id"), table_name="responses")
    op.drop_table("responses")
    op.drop_index(op.f("ix_test_sessions_applicant_id"), table_name="test_sessions")
    op.drop_table("test_sessions")
    op.drop_table("items")
    op.drop_index(op.f("ix_ielts_checks_applicant_id"), table_name="ielts_checks")
    op.drop_table("ielts_checks")
    op.drop_index(op.f("ix_applicants_external_id"), table_name="applicants")
    op.drop_table("applicants")
