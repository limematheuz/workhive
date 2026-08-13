"""add company SWIFT/BIC banking code

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
"""

from alembic import op
import sqlalchemy as sa


revision = "f3a4b5c6d7e8"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("swift_bic", sa.String(length=11)))


def downgrade() -> None:
    op.drop_column("companies", "swift_bic")
