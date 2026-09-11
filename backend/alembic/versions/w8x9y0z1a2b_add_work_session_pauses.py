"""add work session pauses

Revision ID: w8x9y0z1a2b
Revises: v7w8x9y0z1a
Create Date: 2026-09-11
"""

import sqlalchemy as sa
from alembic import op


revision = "w8x9y0z1a2b"
down_revision = "v7w8x9y0z1a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "work_sessions", sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "work_sessions",
        sa.Column("paused_seconds", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "work_session_pauses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("work_session_id", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["work_session_id"], ["work_sessions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_work_session_pauses_work_session_id",
        "work_session_pauses",
        ["work_session_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_work_session_pauses_work_session_id", "work_session_pauses")
    op.drop_table("work_session_pauses")
    op.drop_column("work_sessions", "paused_seconds")
    op.drop_column("work_sessions", "paused_at")
