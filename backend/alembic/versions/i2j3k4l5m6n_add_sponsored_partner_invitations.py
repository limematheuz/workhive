"""add sponsored partner invitations

Revision ID: i2j3k4l5m6n
Revises: h1i2j3k4l5m
"""

from alembic import op
import sqlalchemy as sa


revision = "i2j3k4l5m6n"
down_revision = "h1i2j3k4l5m"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sponsored_partner_invitations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("host_company_id", sa.Integer(), nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), nullable=True),
        sa.Column("accepted_company_id", sa.Integer(), nullable=True),
        sa.Column("accepted_user_id", sa.Integer(), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("company_name", sa.String(length=100), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("verification_code_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')",
            name="ck_sponsored_partner_invitation_status",
        ),
        sa.ForeignKeyConstraint(["host_company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["accepted_company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["accepted_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    for column in (
        "host_company_id",
        "invited_by_user_id",
        "accepted_company_id",
        "accepted_user_id",
        "email",
        "token_hash",
        "verification_code_hash",
        "status",
        "expires_at",
    ):
        op.create_index(
            f"ix_sponsored_partner_invitations_{column}",
            "sponsored_partner_invitations",
            [column],
        )


def downgrade() -> None:
    for column in (
        "expires_at",
        "status",
        "verification_code_hash",
        "token_hash",
        "email",
        "accepted_user_id",
        "accepted_company_id",
        "invited_by_user_id",
        "host_company_id",
    ):
        op.drop_index(
            f"ix_sponsored_partner_invitations_{column}",
            table_name="sponsored_partner_invitations",
        )
    op.drop_table("sponsored_partner_invitations")
