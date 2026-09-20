"""add_rating_events

Revision ID: c3f9a1d2e6b7
Revises: 08842b9483e2
Create Date: 2026-09-20 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "c3f9a1d2e6b7"
down_revision: Union[str, None] = "08842b9483e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rating_events",
        sa.Column("id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("session_id", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("indicator", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("quote", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("band", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("rater_type", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("rater_id", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"]),
        sa.ForeignKeyConstraint(["rater_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_rating_events_session_id"), "rating_events", ["session_id"], unique=False
    )
    op.create_index(
        op.f("ix_rating_events_indicator"), "rating_events", ["indicator"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_rating_events_indicator"), table_name="rating_events")
    op.drop_index(op.f("ix_rating_events_session_id"), table_name="rating_events")
    op.drop_table("rating_events")
