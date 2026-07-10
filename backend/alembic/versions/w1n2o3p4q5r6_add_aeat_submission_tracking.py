"""add AEAT submission tracking

Revision ID: w1n2o3p4q5r6
Revises: v0m1n2o3p4q5
"""

from alembic import op
import sqlalchemy as sa


revision = "w1n2o3p4q5r6"
down_revision = "v0m1n2o3p4q5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "companies",
        sa.Column("postal_code", sa.String(length=10), nullable=True),
    )
    op.add_column(
        "companies",
        sa.Column("city", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "companies",
        sa.Column("province", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "clients",
        sa.Column("province", sa.String(length=100), nullable=True),
    )
    op.add_column("invoices", sa.Column("facturae_path", sa.Text(), nullable=True))
    op.add_column(
        "invoices",
        sa.Column("facturae_sha256", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "invoices",
        sa.Column(
            "facturae_generated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "invoices",
        sa.Column(
            "rectification_reason_code",
            sa.String(length=2),
            nullable=True,
        ),
    )
    op.add_column(
        "invoices",
        sa.Column("facturae_signed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "invoices",
        sa.Column(
            "facturae_signature_status",
            sa.String(length=20),
            server_default="not_generated",
            nullable=False,
        ),
    )
    op.add_column(
        "fiscal_invoice_records",
        sa.Column("request_xml", sa.Text(), nullable=True),
    )
    op.add_column(
        "fiscal_invoice_records",
        sa.Column("response_xml", sa.Text(), nullable=True),
    )
    op.add_column(
        "fiscal_invoice_records",
        sa.Column("operation_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "fiscal_invoice_records",
        sa.Column(
            "attempt_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "fiscal_invoice_records",
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "fiscal_invoice_records",
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("fiscal_invoice_records", "next_retry_at")
    op.drop_column("fiscal_invoice_records", "last_attempt_at")
    op.drop_column("fiscal_invoice_records", "attempt_count")
    op.drop_column("fiscal_invoice_records", "operation_reason")
    op.drop_column("fiscal_invoice_records", "response_xml")
    op.drop_column("fiscal_invoice_records", "request_xml")
    op.drop_column("invoices", "facturae_signature_status")
    op.drop_column("invoices", "rectification_reason_code")
    op.drop_column("invoices", "facturae_signed_at")
    op.drop_column("invoices", "facturae_generated_at")
    op.drop_column("invoices", "facturae_sha256")
    op.drop_column("invoices", "facturae_path")
    op.drop_column("clients", "province")
    op.drop_column("companies", "province")
    op.drop_column("companies", "city")
    op.drop_column("companies", "postal_code")
