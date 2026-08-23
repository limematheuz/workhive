"""add protected location access details

Revision ID: m3n4o5p6q7
Revises: l2m3n4o5p6
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "m3n4o5p6q7"
down_revision: str | None = "l2m3n4o5p6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "location_access_profiles",
        sa.Column(
            "location_id",
            sa.Integer(),
            sa.ForeignKey("locations.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("permitted_days", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("permitted_from", sa.String(length=5), nullable=True),
        sa.Column("permitted_until", sa.String(length=5), nullable=True),
        sa.Column(
            "requires_outside_hours_authorization",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("access_method", sa.String(length=50), nullable=True),
        sa.Column("keys_available", sa.Boolean(), nullable=True),
        sa.Column("keys_location", sa.String(length=160), nullable=True),
        sa.Column("key_custodian", sa.String(length=120), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("access_code_encrypted", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.alter_column("location_access_profiles", "permitted_days", server_default=None)
    op.alter_column(
        "location_access_profiles",
        "requires_outside_hours_authorization",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_table("location_access_profiles")
