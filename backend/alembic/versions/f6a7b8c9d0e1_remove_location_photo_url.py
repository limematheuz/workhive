"""remove location photo url

Revision ID: f6a7b8c9d0e1
Revises: m3n4o5p6q7
"""

import sqlalchemy as sa
from alembic import op


revision = "f6a7b8c9d0e1"
down_revision = "m3n4o5p6q7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("locations", "photo_url")


def downgrade() -> None:
    op.add_column("locations", sa.Column("photo_url", sa.Text(), nullable=True))
