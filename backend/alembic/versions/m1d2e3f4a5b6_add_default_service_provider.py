"""add default service provider to locations

Revision ID: m1d2e3f4a5b6
Revises: l0c1d2e3f4a5
"""

from alembic import op
import sqlalchemy as sa


revision = "m1d2e3f4a5b6"
down_revision = "l0c1d2e3f4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "locations",
        sa.Column("default_service_provider_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_locations_default_service_provider_id",
        "locations",
        ["default_service_provider_id"],
    )
    op.create_foreign_key(
        "fk_locations_default_service_provider_id",
        "locations",
        "companies",
        ["default_service_provider_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_locations_default_service_provider_id",
        "locations",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_locations_default_service_provider_id",
        table_name="locations",
    )
    op.drop_column("locations", "default_service_provider_id")
