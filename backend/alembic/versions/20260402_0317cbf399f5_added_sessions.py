"""added sessions

Revision ID: 0317cbf399f5
Revises: 7ee7e2dd8525
Create Date: 2026-04-02 14:08:13.596949

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '0317cbf399f5'
down_revision: Union[str, None] = '7ee7e2dd8525'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No-op: the `sessions` table this revision was meant to add is created by the
    # baseline `18680c0bb149_initial_tables` revision instead (it was missing there
    # originally). Kept as a no-op to preserve the existing revision chain/IDs.
    pass


def downgrade() -> None:
    pass
