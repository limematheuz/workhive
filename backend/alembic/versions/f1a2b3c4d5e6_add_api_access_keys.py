"""add api access keys

Revision ID: f1a2b3c4d5e6
Revises: e0f1a2b3c4d5
"""

from alembic import op
import sqlalchemy as sa


revision = "f1a2b3c4d5e6"
down_revision = "e0f1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "api_access_keys",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("revoked_by_user_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("key_prefix", sa.String(length=20), nullable=False, unique=True),
        sa.Column("key_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("scopes", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('active', 'revoked')", name="ck_api_access_key_status"),
        sa.CheckConstraint("revoked_at IS NULL OR revoked_at >= created_at", name="ck_api_access_key_revocation_date"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["revoked_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("company_id", "name", name="uq_api_access_key_company_name"),
    )
    for column in (
        "company_id",
        "created_by_user_id",
        "revoked_by_user_id",
        "key_prefix",
        "key_hash",
        "status",
        "expires_at",
    ):
        op.create_index(f"ix_api_access_keys_{column}", "api_access_keys", [column])


def downgrade() -> None:
    for column in (
        "expires_at",
        "status",
        "key_hash",
        "key_prefix",
        "revoked_by_user_id",
        "created_by_user_id",
        "company_id",
    ):
        op.drop_index(f"ix_api_access_keys_{column}", table_name="api_access_keys")
    op.drop_table("api_access_keys")
