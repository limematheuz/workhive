"""add opaque object-storage references for fiscal documents

Revision ID: j4k5l6m7n8o
Revises: i2j3k4l5m6n
"""

from alembic import op
import sqlalchemy as sa


revision = "j4k5l6m7n8o"
down_revision = "i2j3k4l5m6n"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for name, column in (
        ("pdf_storage_key", sa.String(length=500)),
        ("pdf_content_type", sa.String(length=120)),
        ("pdf_size_bytes", sa.Integer()),
        ("facturae_storage_key", sa.String(length=500)),
        ("facturae_content_type", sa.String(length=120)),
        ("facturae_size_bytes", sa.Integer()),
    ):
        op.add_column("invoices", sa.Column(name, column, nullable=True))

    for name, column in (
        ("certificate_storage_key", sa.String(length=500)),
        ("certificate_sha256", sa.String(length=64)),
        ("certificate_content_type", sa.String(length=120)),
        ("certificate_size_bytes", sa.Integer()),
    ):
        op.add_column(
            "company_fiscal_settings",
            sa.Column(name, column, nullable=True),
        )


def downgrade() -> None:
    for name in (
        "certificate_size_bytes",
        "certificate_content_type",
        "certificate_sha256",
        "certificate_storage_key",
    ):
        op.drop_column("company_fiscal_settings", name)

    for name in (
        "facturae_size_bytes",
        "facturae_content_type",
        "facturae_storage_key",
        "pdf_size_bytes",
        "pdf_content_type",
        "pdf_storage_key",
    ):
        op.drop_column("invoices", name)
