"""add stable location owner company

Revision ID: l0c1d2e3f4a5
Revises: k9b0c1d2e3f4
"""

from alembic import op
import sqlalchemy as sa


revision = "l0c1d2e3f4a5"
down_revision = "k9b0c1d2e3f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "locations",
        sa.Column("owner_company_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_locations_owner_company_id",
        "locations",
        ["owner_company_id"],
    )
    op.create_foreign_key(
        "fk_locations_owner_company_id",
        "locations",
        "companies",
        ["owner_company_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.execute(
        """
        UPDATE locations
        SET owner_company_id = COALESCE(
            (SELECT clients.company_id
             FROM clients
             WHERE clients.id = locations.client_id),
            managing_company_id
        )
        WHERE owner_company_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_locations_owner_company_id",
        "locations",
        type_="foreignkey",
    )
    op.drop_index("ix_locations_owner_company_id", table_name="locations")
    op.drop_column("locations", "owner_company_id")
