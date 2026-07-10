"""add company document defaults

Revision ID: f0a1b2c3d4e5
Revises: e9f0a1b2c3d4
"""

from alembic import op
import sqlalchemy as sa


revision = "f0a1b2c3d4e5"
down_revision = "e9f0a1b2c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "companies",
        sa.Column("default_payment_notes", sa.Text(), nullable=True),
    )
    op.add_column(
        "companies",
        sa.Column("default_document_terms", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("companies", "default_document_terms")
    op.drop_column("companies", "default_payment_notes")
