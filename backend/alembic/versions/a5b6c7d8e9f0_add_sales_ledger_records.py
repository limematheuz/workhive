"""add manual sales ledger records

Revision ID: h5i6j7k8l9m0
Revises: g4a5b6c7d8e9
"""

from alembic import op
import sqlalchemy as sa


revision = "h5i6j7k8l9m0"
down_revision = "g4a5b6c7d8e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sales_ledger_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("document_number", sa.String(length=50), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("client_name", sa.String(length=160), nullable=False),
        sa.Column("base_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("tax_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("payment_status", sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("base_amount >= 0", name="ck_sales_ledger_record_base_amount"),
        sa.CheckConstraint("tax_amount >= 0", name="ck_sales_ledger_record_tax_amount"),
        sa.CheckConstraint("total_amount >= 0", name="ck_sales_ledger_record_total_amount"),
        sa.CheckConstraint("payment_status IN ('paid', 'pending')", name="ck_sales_ledger_record_payment_status"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "document_number", name="uq_sales_ledger_record_company_document"),
    )
    op.create_index("ix_sales_ledger_records_company_id", "sales_ledger_records", ["company_id"])
    op.create_index("ix_sales_ledger_records_created_by_user_id", "sales_ledger_records", ["created_by_user_id"])
    op.create_index("ix_sales_ledger_records_entry_date", "sales_ledger_records", ["entry_date"])
    op.create_index("ix_sales_ledger_records_client_name", "sales_ledger_records", ["client_name"])


def downgrade() -> None:
    op.drop_index("ix_sales_ledger_records_client_name", table_name="sales_ledger_records")
    op.drop_index("ix_sales_ledger_records_entry_date", table_name="sales_ledger_records")
    op.drop_index("ix_sales_ledger_records_created_by_user_id", table_name="sales_ledger_records")
    op.drop_index("ix_sales_ledger_records_company_id", table_name="sales_ledger_records")
    op.drop_table("sales_ledger_records")
