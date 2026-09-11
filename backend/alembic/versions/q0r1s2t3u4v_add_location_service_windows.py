"""add service windows per location

Revision ID: q0r1s2t3u4v
Revises: p9q0r1s2t3u
"""

from alembic import op
import sqlalchemy as sa


revision = "q0r1s2t3u4v"
down_revision = "p9q0r1s2t3u"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "location_service_windows",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "location_id",
            sa.Integer(),
            sa.ForeignKey("locations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.String(length=120), nullable=True),
        sa.Column("days", sa.JSON(), nullable=False),
        sa.Column("starts_at", sa.String(length=5), nullable=False),
        sa.Column("ends_at", sa.String(length=5), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_location_service_windows_location_id",
        "location_service_windows",
        ["location_id"],
    )
    op.create_index(
        "ix_location_service_windows_is_active",
        "location_service_windows",
        ["is_active"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_location_service_windows_is_active",
        table_name="location_service_windows",
    )
    op.drop_index(
        "ix_location_service_windows_location_id",
        table_name="location_service_windows",
    )
    op.drop_table("location_service_windows")
