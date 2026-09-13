"""add client portal access

Revision ID: e0f1a2b3c4d5
Revises: d9e0f1a2b3c4
"""

from alembic import op
import sqlalchemy as sa


revision = "e0f1a2b3c4d5"
down_revision = "d9e0f1a2b3c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_portal_grants",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("granted_by_user_id", sa.Integer(), nullable=True),
        sa.Column("revoked_by_user_id", sa.Integer(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('active', 'revoked')", name="ck_client_portal_grant_status"),
        sa.CheckConstraint("revoked_at IS NULL OR revoked_at >= created_at", name="ck_client_portal_grant_revocation_date"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id", "company_id"], ["clients.id", "clients.company_id"], name="fk_client_portal_grant_client_company", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["granted_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["revoked_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("company_id", "client_id", "user_id", name="uq_client_portal_grant_company_client_user"),
    )
    for column in ("company_id", "client_id", "user_id", "status", "expires_at", "granted_by_user_id", "revoked_by_user_id"):
        op.create_index(f"ix_client_portal_grants_{column}", "client_portal_grants", [column])

    op.create_table(
        "client_portal_invitations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), nullable=True),
        sa.Column("accepted_user_id", sa.Integer(), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("verification_code_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('pending', 'accepted', 'revoked', 'expired')", name="ck_client_portal_invitation_status"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id", "company_id"], ["clients.id", "clients.company_id"], name="fk_client_portal_invitation_client_company", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["accepted_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    for column in ("company_id", "client_id", "invited_by_user_id", "accepted_user_id", "email", "token_hash", "verification_code_hash", "status", "expires_at"):
        op.create_index(f"ix_client_portal_invitations_{column}", "client_portal_invitations", [column])

    op.execute(
        """
        INSERT INTO roles (name, description, is_active)
        SELECT 'client_portal', 'Document-only customer portal user', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'client_portal')
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM roles WHERE name = 'client_portal'")
    for column in ("expires_at", "status", "verification_code_hash", "token_hash", "email", "accepted_user_id", "invited_by_user_id", "client_id", "company_id"):
        op.drop_index(f"ix_client_portal_invitations_{column}", table_name="client_portal_invitations")
    op.drop_table("client_portal_invitations")
    for column in ("revoked_by_user_id", "granted_by_user_id", "expires_at", "status", "user_id", "client_id", "company_id"):
        op.drop_index(f"ix_client_portal_grants_{column}", table_name="client_portal_grants")
    op.drop_table("client_portal_grants")
