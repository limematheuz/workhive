"""add immutable bank statement entries and receipt reconciliation

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
"""

import sqlalchemy as sa
from alembic import op


revision = "c8d9e0f1a2b3"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bank_statement_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("booked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="EUR"),
        sa.Column("account_label", sa.String(length=100), nullable=True),
        sa.Column("external_id", sa.String(length=160), nullable=True),
        sa.Column("reference", sa.String(length=160), nullable=True),
        sa.Column("counterparty", sa.String(length=160), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="unmatched"),
        sa.Column(
            "created_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "amount > 0", name="ck_bank_statement_entry_amount_positive"
        ),
        sa.CheckConstraint(
            "status IN ('unmatched', 'matched')",
            name="ck_bank_statement_entry_status",
        ),
        sa.UniqueConstraint(
            "company_id",
            "external_id",
            name="uq_bank_statement_entry_company_external_id",
        ),
    )
    for column in (
        "company_id",
        "booked_at",
        "reference",
        "status",
        "created_by_user_id",
    ):
        op.create_index(
            f"ix_bank_statement_entries_{column}",
            "bank_statement_entries",
            [column],
        )

    op.create_table(
        "bank_reconciliations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "bank_statement_entry_id",
            sa.Integer(),
            sa.ForeignKey("bank_statement_entries.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "customer_payment_id",
            sa.Integer(),
            sa.ForeignKey("customer_payments.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="matched"),
        sa.Column(
            "matched_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "matched_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reversed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "reversed_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reversal_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "status IN ('matched', 'reversed')",
            name="ck_bank_reconciliation_status",
        ),
    )
    for column in (
        "bank_statement_entry_id",
        "customer_payment_id",
        "status",
        "matched_by_user_id",
        "reversed_by_user_id",
    ):
        op.create_index(
            f"ix_bank_reconciliations_{column}", "bank_reconciliations", [column]
        )
    op.create_index(
        "ix_bank_reconciliation_entry_status",
        "bank_reconciliations",
        ["bank_statement_entry_id", "status"],
    )
    op.create_index(
        "ix_bank_reconciliation_payment_status",
        "bank_reconciliations",
        ["customer_payment_id", "status"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_bank_reconciliation_payment_status", table_name="bank_reconciliations"
    )
    op.drop_index(
        "ix_bank_reconciliation_entry_status", table_name="bank_reconciliations"
    )
    for column in (
        "reversed_by_user_id",
        "matched_by_user_id",
        "status",
        "customer_payment_id",
        "bank_statement_entry_id",
    ):
        op.drop_index(f"ix_bank_reconciliations_{column}", table_name="bank_reconciliations")
    op.drop_table("bank_reconciliations")

    for column in (
        "created_by_user_id",
        "status",
        "reference",
        "booked_at",
        "company_id",
    ):
        op.drop_index(
            f"ix_bank_statement_entries_{column}", table_name="bank_statement_entries"
        )
    op.drop_table("bank_statement_entries")
