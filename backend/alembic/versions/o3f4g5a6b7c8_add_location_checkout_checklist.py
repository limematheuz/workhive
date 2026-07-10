"""add location checkout checklist

Revision ID: o3f4g5a6b7c8
Revises: n2e3f4a5b6c7
"""

from alembic import op
import sqlalchemy as sa


revision = "o3f4g5a6b7c8"
down_revision = "n2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "locations",
        sa.Column("checkout_checklist", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("locations", "checkout_checklist")
