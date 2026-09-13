"""add private quality evidence images

Revision ID: d4e5f6a7b8c
Revises: c3d4e5f6a7b8
"""

import sqlalchemy as sa
from alembic import op


revision = "d4e5f6a7b8c"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quality_evidence",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column("inspection_id", sa.Integer(), nullable=True),
        sa.Column("incident_id", sa.Integer(), nullable=True),
        sa.Column("media_key", sa.String(length=500), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=True),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "(inspection_id IS NOT NULL AND incident_id IS NULL) OR "
            "(inspection_id IS NULL AND incident_id IS NOT NULL)",
            name="ck_quality_evidence_one_subject",
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["inspection_id"], ["quality_inspections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["incident_id"], ["quality_incidents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("media_key", name="uq_quality_evidence_media_key"),
    )
    for column in ("company_id", "location_id", "inspection_id", "incident_id", "created_at"):
        op.create_index(f"ix_quality_evidence_{column}", "quality_evidence", [column])


def downgrade() -> None:
    for column in ("created_at", "incident_id", "inspection_id", "location_id", "company_id"):
        op.drop_index(f"ix_quality_evidence_{column}", table_name="quality_evidence")
    op.drop_table("quality_evidence")
