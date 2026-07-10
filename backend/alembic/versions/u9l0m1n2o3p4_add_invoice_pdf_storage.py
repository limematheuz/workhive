"""add definitive invoice PDF storage

Revision ID: u9l0m1n2o3p4
Revises: t8k9l0m1n2o3
"""

from alembic import op
import sqlalchemy as sa


revision = "u9l0m1n2o3p4"
down_revision = "t8k9l0m1n2o3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("pdf_path", sa.Text(), nullable=True))
    op.add_column(
        "invoices",
        sa.Column("pdf_sha256", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "invoices",
        sa.Column("pdf_generated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("invoices", "pdf_generated_at")
    op.drop_column("invoices", "pdf_sha256")
    op.drop_column("invoices", "pdf_path")
