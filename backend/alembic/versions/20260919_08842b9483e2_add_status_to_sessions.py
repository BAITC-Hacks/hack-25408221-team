"""add_status_to_sessions

Revision ID: 08842b9483e2
Revises: 6a5febe4cf83
Create Date: 2026-09-19 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "08842b9483e2"
down_revision: Union[str, None] = "6a5febe4cf83"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column(
            "status",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
            server_default="in_progress",
        ),
    )
    op.execute("UPDATE sessions SET status = 'completed' WHERE completed_at IS NOT NULL")


def downgrade() -> None:
    op.drop_column("sessions", "status")
