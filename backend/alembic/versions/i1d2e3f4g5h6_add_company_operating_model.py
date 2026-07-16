"""add company operating model

Revision ID: i1d2e3f4g5h6
Revises: h0c1d2e3f4a5
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "i1d2e3f4g5h6"
down_revision: str | None = "h0c1d2e3f4a5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "companies",
        sa.Column("operating_model", sa.String(length=30), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("companies", "operating_model")
