"""make external reservation references idempotent

Revision ID: b2c3d4e5f6a7
Revises: f1a2b3c4d5e6
"""

from alembic import op


revision = "b2c3d4e5f6a7"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("reservations") as batch:
        batch.create_unique_constraint(
            "uq_reservation_owner_source_external_reference",
            ["owner_company_id", "source", "external_reference"],
        )


def downgrade() -> None:
    with op.batch_alter_table("reservations") as batch:
        batch.drop_constraint(
            "uq_reservation_owner_source_external_reference",
            type_="unique",
        )
