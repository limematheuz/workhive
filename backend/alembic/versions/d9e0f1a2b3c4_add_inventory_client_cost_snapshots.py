"""add client snapshots to inventory consumptions

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
"""

import sqlalchemy as sa
from alembic import op


revision = "d9e0f1a2b3c4"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Batch mode keeps the full migration path executable on SQLite too.
    with op.batch_alter_table("inventory_movements") as batch:
        batch.add_column(sa.Column("client_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_inventory_movements_client_id",
            "clients",
            ["client_id"],
            ["id"],
            ondelete="RESTRICT",
        )
    op.create_index(
        "ix_inventory_movements_client_id", "inventory_movements", ["client_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_inventory_movements_client_id", table_name="inventory_movements")
    with op.batch_alter_table("inventory_movements") as batch:
        batch.drop_constraint("fk_inventory_movements_client_id", type_="foreignkey")
        batch.drop_column("client_id")
