"""add verified worker invitations

Revision ID: c5d6e7f8a9b0
Revises: b8c9d0e1f2a3
"""

from alembic import op
import sqlalchemy as sa


revision = "c5d6e7f8a9b0"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_invitations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invited_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("role_id", sa.Integer(), sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=100), nullable=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_user_invitations_company_id", "user_invitations", ["company_id"])
    op.create_index("ix_user_invitations_invited_by_user_id", "user_invitations", ["invited_by_user_id"])
    op.create_index("ix_user_invitations_email", "user_invitations", ["email"])
    op.create_index("ix_user_invitations_token_hash", "user_invitations", ["token_hash"])
    op.create_index("ix_user_invitations_status", "user_invitations", ["status"])
    op.create_index("ix_user_invitations_expires_at", "user_invitations", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_user_invitations_expires_at", table_name="user_invitations")
    op.drop_index("ix_user_invitations_status", table_name="user_invitations")
    op.drop_index("ix_user_invitations_token_hash", table_name="user_invitations")
    op.drop_index("ix_user_invitations_email", table_name="user_invitations")
    op.drop_index("ix_user_invitations_invited_by_user_id", table_name="user_invitations")
    op.drop_index("ix_user_invitations_company_id", table_name="user_invitations")
    op.drop_table("user_invitations")
