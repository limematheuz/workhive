"""add client acceptance for completed quality inspections

Revision ID: f6a7b8c9d0e
Revises: e5f6a7b8c9d
"""

import sqlalchemy as sa
from alembic import op


revision = "f6a7b8c9d0e"
down_revision = "e5f6a7b8c9d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quality_inspection_client_acceptances",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("inspection_id", sa.Integer(), nullable=False),
        sa.Column("client_portal_grant_id", sa.Integer(), nullable=True),
        sa.Column("signed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("signer_name", sa.String(length=255), nullable=False),
        sa.Column("signer_email", sa.String(length=320), nullable=False),
        sa.Column("statement_version", sa.String(length=40), nullable=False),
        sa.Column("content_digest", sa.String(length=64), nullable=False),
        sa.Column(
            "signed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["inspection_id"], ["quality_inspections.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["client_portal_grant_id"],
            ["client_portal_grants.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["signed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "inspection_id", name="uq_quality_inspection_client_acceptance_inspection"
        ),
    )
    op.create_index(
        "ix_quality_inspection_client_acceptances_inspection_id",
        "quality_inspection_client_acceptances",
        ["inspection_id"],
    )
    op.create_index(
        "ix_quality_inspection_client_acceptances_client_portal_grant_id",
        "quality_inspection_client_acceptances",
        ["client_portal_grant_id"],
    )
    op.create_index(
        "ix_quality_inspection_client_acceptances_signed_at",
        "quality_inspection_client_acceptances",
        ["signed_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_quality_inspection_client_acceptances_signed_at",
        table_name="quality_inspection_client_acceptances",
    )
    op.drop_index(
        "ix_quality_inspection_client_acceptances_client_portal_grant_id",
        table_name="quality_inspection_client_acceptances",
    )
    op.drop_index(
        "ix_quality_inspection_client_acceptances_inspection_id",
        table_name="quality_inspection_client_acceptances",
    )
    op.drop_table("quality_inspection_client_acceptances")
