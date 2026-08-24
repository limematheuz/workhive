"""add optional location zones to work orders

Revision ID: k1l2m3n4o5p6
Revises: z5q6r7s8t9u0
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "k1l2m3n4o5p6"
down_revision: str | None = "z5q6r7s8t9u0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "location_zones",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "location_id",
            sa.Integer(),
            sa.ForeignKey("locations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("zone_type", sa.String(length=50), nullable=False, server_default="other"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_location_zones_location_id", "location_zones", ["location_id"])

    op.create_table(
        "task_zones",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("task_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "zone_id",
            sa.Integer(),
            sa.ForeignKey("location_zones.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("zone_name", sa.String(length=100), nullable=False),
        sa.Column("zone_type", sa.String(length=50), nullable=False),
        sa.UniqueConstraint("task_id", "zone_id", name="uq_task_zone"),
    )
    op.create_index("ix_task_zones_task_id", "task_zones", ["task_id"])
    op.create_index("ix_task_zones_zone_id", "task_zones", ["zone_id"])


def downgrade() -> None:
    op.drop_index("ix_task_zones_zone_id", table_name="task_zones")
    op.drop_index("ix_task_zones_task_id", table_name="task_zones")
    op.drop_table("task_zones")
    op.drop_index("ix_location_zones_location_id", table_name="location_zones")
    op.drop_table("location_zones")
