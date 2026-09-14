"""add internal quality inspection conformity

Revision ID: e5f6a7b8c9d
Revises: d4e5f6a7b8c
"""

import sqlalchemy as sa
from alembic import op


revision = "e5f6a7b8c9d"
down_revision = "d4e5f6a7b8c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quality_inspection_conformities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("inspection_id", sa.Integer(), nullable=False),
        sa.Column("signed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("signer_name", sa.String(length=255), nullable=False),
        sa.Column("statement_version", sa.String(length=40), nullable=False),
        sa.Column(
            "signed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["inspection_id"], ["quality_inspections.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["signed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "inspection_id", name="uq_quality_inspection_conformity_inspection"
        ),
    )
    op.create_index(
        "ix_quality_inspection_conformities_inspection_id",
        "quality_inspection_conformities",
        ["inspection_id"],
    )
    op.create_index(
        "ix_quality_inspection_conformities_signed_at",
        "quality_inspection_conformities",
        ["signed_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_quality_inspection_conformities_signed_at",
        table_name="quality_inspection_conformities",
    )
    op.drop_index(
        "ix_quality_inspection_conformities_inspection_id",
        table_name="quality_inspection_conformities",
    )
    op.drop_table("quality_inspection_conformities")
