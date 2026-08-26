"""add company collaboration email invitations

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
"""

from alembic import op
import sqlalchemy as sa


revision = "g7h8i9j0k1l2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_collaboration_invitations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("inviter_company_id", sa.Integer(), nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), nullable=True),
        sa.Column("accepted_company_id", sa.Integer(), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("role_type", sa.String(length=30), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["accepted_company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["inviter_company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_company_collaboration_invitations_inviter_company_id"), "company_collaboration_invitations", ["inviter_company_id"])
    op.create_index(op.f("ix_company_collaboration_invitations_invited_by_user_id"), "company_collaboration_invitations", ["invited_by_user_id"])
    op.create_index(op.f("ix_company_collaboration_invitations_accepted_company_id"), "company_collaboration_invitations", ["accepted_company_id"])
    op.create_index(op.f("ix_company_collaboration_invitations_email"), "company_collaboration_invitations", ["email"])
    op.create_index(op.f("ix_company_collaboration_invitations_token_hash"), "company_collaboration_invitations", ["token_hash"], unique=True)
    op.create_index(op.f("ix_company_collaboration_invitations_status"), "company_collaboration_invitations", ["status"])
    op.create_index(op.f("ix_company_collaboration_invitations_expires_at"), "company_collaboration_invitations", ["expires_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_company_collaboration_invitations_expires_at"), table_name="company_collaboration_invitations")
    op.drop_index(op.f("ix_company_collaboration_invitations_status"), table_name="company_collaboration_invitations")
    op.drop_index(op.f("ix_company_collaboration_invitations_token_hash"), table_name="company_collaboration_invitations")
    op.drop_index(op.f("ix_company_collaboration_invitations_email"), table_name="company_collaboration_invitations")
    op.drop_index(op.f("ix_company_collaboration_invitations_accepted_company_id"), table_name="company_collaboration_invitations")
    op.drop_index(op.f("ix_company_collaboration_invitations_invited_by_user_id"), table_name="company_collaboration_invitations")
    op.drop_index(op.f("ix_company_collaboration_invitations_inviter_company_id"), table_name="company_collaboration_invitations")
    op.drop_table("company_collaboration_invitations")
