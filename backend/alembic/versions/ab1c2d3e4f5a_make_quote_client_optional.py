"""make quote client optional

Revision ID: ab1c2d3e4f5a
Revises: aa1b2c3d4e5f
Create Date: 2026-08-06
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "ab1c2d3e4f5a"
down_revision: str | None = "aa1b2c3d4e5f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("quotes") as batch_op:
        batch_op.alter_column(
            "client_id",
            existing_type=sa.Integer(),
            nullable=True,
        )


def downgrade() -> None:
    orphan_count = op.get_bind().execute(
        sa.text("SELECT COUNT(*) FROM quotes WHERE client_id IS NULL")
    ).scalar_one()
    if orphan_count:
        raise RuntimeError(
            "Cannot make quotes.client_id required while quotes without a registered client exist"
        )
    with op.batch_alter_table("quotes") as batch_op:
        batch_op.alter_column(
            "client_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
