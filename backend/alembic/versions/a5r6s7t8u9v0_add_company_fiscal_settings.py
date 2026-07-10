"""add company fiscal settings

Revision ID: a5r6s7t8u9v0
Revises: a6b7c8d9e0f1
"""

from alembic import op
import sqlalchemy as sa


revision = "a5r6s7t8u9v0"
down_revision = "a6b7c8d9e0f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_fiscal_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("environment", sa.String(length=20), nullable=False),
        sa.Column("certificate_path", sa.Text(), nullable=True),
        sa.Column("certificate_password_encrypted", sa.Text(), nullable=True),
        sa.Column("certificate_uploaded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id"),
    )
    op.create_index(
        op.f("ix_company_fiscal_settings_company_id"),
        "company_fiscal_settings",
        ["company_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_company_fiscal_settings_company_id"),
        table_name="company_fiscal_settings",
    )
    op.drop_table("company_fiscal_settings")
