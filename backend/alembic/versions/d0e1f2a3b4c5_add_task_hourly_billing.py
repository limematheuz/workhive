"""add task hourly billing fields

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
"""

from alembic import op
import sqlalchemy as sa


revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("task_items") as batch:
        batch.add_column(
            sa.Column(
                "pricing_mode",
                sa.String(length=20),
                nullable=False,
                server_default="fixed",
            )
        )
        batch.add_column(
            sa.Column("worked_seconds_snapshot", sa.Integer(), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("task_items") as batch:
        batch.drop_column("worked_seconds_snapshot")
        batch.drop_column("pricing_mode")
