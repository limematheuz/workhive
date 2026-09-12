"""add customer receipts with invoice allocations

Revision ID: b7c8d9e0f1a2
Revises: a6b7c8d9e0f
"""

import sqlalchemy as sa
from alembic import op


revision = "b7c8d9e0f1a2"
down_revision = "a6b7c8d9e0f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer_payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            sa.Integer(),
            sa.ForeignKey("clients.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("payment_method", sa.String(length=30), nullable=True),
        sa.Column("reference", sa.String(length=160), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="received"),
        sa.Column(
            "created_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "voided_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("void_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("amount > 0", name="ck_customer_payment_amount_positive"),
        sa.CheckConstraint(
            "status IN ('received', 'voided')", name="ck_customer_payment_status"
        ),
    )
    for column in (
        "company_id",
        "client_id",
        "received_at",
        "reference",
        "status",
        "created_by_user_id",
        "voided_by_user_id",
    ):
        op.create_index(f"ix_customer_payments_{column}", "customer_payments", [column])

    op.create_table(
        "customer_payment_allocations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "payment_id",
            sa.Integer(),
            sa.ForeignKey("customer_payments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invoice_id",
            sa.Integer(),
            sa.ForeignKey("invoices.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "amount > 0", name="ck_customer_payment_allocation_amount_positive"
        ),
        sa.UniqueConstraint(
            "payment_id",
            "invoice_id",
            name="uq_customer_payment_allocation_payment_invoice",
        ),
    )
    op.create_index(
        "ix_customer_payment_allocations_payment_id",
        "customer_payment_allocations",
        ["payment_id"],
    )
    op.create_index(
        "ix_customer_payment_allocations_invoice_id",
        "customer_payment_allocations",
        ["invoice_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_customer_payment_allocations_invoice_id",
        table_name="customer_payment_allocations",
    )
    op.drop_index(
        "ix_customer_payment_allocations_payment_id",
        table_name="customer_payment_allocations",
    )
    op.drop_table("customer_payment_allocations")
    for column in (
        "voided_by_user_id",
        "created_by_user_id",
        "status",
        "reference",
        "received_at",
        "client_id",
        "company_id",
    ):
        op.drop_index(f"ix_customer_payments_{column}", table_name="customer_payments")
    op.drop_table("customer_payments")
