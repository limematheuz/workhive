"""add structured invoice payment method

Revision ID: g4a5b6c7d8e9
Revises: f3a4b5c6d7e8
"""

from alembic import op
import sqlalchemy as sa


revision = "g4a5b6c7d8e9"
down_revision = "f3a4b5c6d7e8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("payment_method", sa.String(length=30)))


def downgrade() -> None:
    op.drop_column("invoices", "payment_method")
