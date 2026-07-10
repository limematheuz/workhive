"""make location client optional

Revision ID: h6e7f8a9b0c1
Revises: g5d6e7f8a9b0
Create Date: 2026-06-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h6e7f8a9b0c1"
down_revision: Union[str, None] = "g5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("locations") as batch_op:
        batch_op.alter_column(
            "client_id",
            existing_type=sa.Integer(),
            nullable=True,
        )


def downgrade() -> None:
    orphan_count = op.get_bind().execute(
        sa.text("SELECT COUNT(*) FROM locations WHERE client_id IS NULL")
    ).scalar_one()
    if orphan_count:
        raise RuntimeError(
            "Cannot downgrade while locations without clients exist"
        )
    with op.batch_alter_table("locations") as batch_op:
        batch_op.alter_column(
            "client_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
