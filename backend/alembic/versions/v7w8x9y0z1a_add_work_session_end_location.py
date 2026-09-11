"""add optional work session end location

Revision ID: v7w8x9y0z1a
Revises: u6v7w8x9y0z
Create Date: 2026-09-11
"""

import sqlalchemy as sa
from alembic import op


revision = "v7w8x9y0z1a"
down_revision = "u6v7w8x9y0z"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("work_sessions", sa.Column("end_latitude", sa.Float(), nullable=True))
    op.add_column("work_sessions", sa.Column("end_longitude", sa.Float(), nullable=True))
    op.add_column(
        "work_sessions", sa.Column("end_accuracy_meters", sa.Float(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("work_sessions", "end_accuracy_meters")
    op.drop_column("work_sessions", "end_longitude")
    op.drop_column("work_sessions", "end_latitude")
