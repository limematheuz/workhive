"""restore location managers

Revision ID: j8a9b0c1d2e3
Revises: i7f8a9b0c1d2
"""

from alembic import op


revision = "j8a9b0c1d2e3"
down_revision = "i7f8a9b0c1d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE locations AS location
        SET managing_company_id = client.company_id
        FROM clients AS client
        WHERE location.client_id = client.id
          AND location.managing_company_id IS NULL
        """
    )


def downgrade() -> None:
    pass
