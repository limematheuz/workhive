"""add invoice email contacts

Revision ID: b6s7t8u9v0w1
Revises: a5r6s7t8u9v0
"""

from alembic import op
import sqlalchemy as sa


revision = "b6s7t8u9v0w1"
down_revision = "a5r6s7t8u9v0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invoice_email_contacts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("use_count", sa.Integer(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "company_id",
            "email",
            name="uq_invoice_email_contact_company_email",
        ),
    )
    op.create_index(
        op.f("ix_invoice_email_contacts_company_id"),
        "invoice_email_contacts",
        ["company_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_invoice_email_contacts_email"),
        "invoice_email_contacts",
        ["email"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_invoice_email_contacts_email"),
        table_name="invoice_email_contacts",
    )
    op.drop_index(
        op.f("ix_invoice_email_contacts_company_id"),
        table_name="invoice_email_contacts",
    )
    op.drop_table("invoice_email_contacts")
