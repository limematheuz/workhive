"""lock agreed task pricing terms and add template billing modes

Revision ID: e2f3a4b5c6d7
Revises: d0e1f2a3b4c5
"""

from alembic import op
import sqlalchemy as sa


revision = "e2f3a4b5c6d7"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("task_items") as batch:
        batch.add_column(sa.Column("pricing_locked_at", sa.DateTime(timezone=True)))
        batch.add_column(sa.Column("billing_pricing_mode_snapshot", sa.String(length=20)))
        batch.add_column(sa.Column("billing_price_snapshot", sa.Float()))
        batch.add_column(sa.Column("billing_quantity_snapshot", sa.Float()))
        batch.add_column(sa.Column("billing_unit_snapshot", sa.String(length=50)))

    with op.batch_alter_table("template_tasks") as batch:
        batch.add_column(
            sa.Column(
                "pricing_mode",
                sa.String(length=20),
                nullable=False,
                server_default="fixed",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("template_tasks") as batch:
        batch.drop_column("pricing_mode")

    with op.batch_alter_table("task_items") as batch:
        batch.drop_column("billing_unit_snapshot")
        batch.drop_column("billing_quantity_snapshot")
        batch.drop_column("billing_price_snapshot")
        batch.drop_column("billing_pricing_mode_snapshot")
        batch.drop_column("pricing_locked_at")
