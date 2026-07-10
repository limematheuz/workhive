"""make client contact optional

Revision ID: i7f8a9b0c1d2
Revises: h6e7f8a9b0c1
"""

from alembic import op
import sqlalchemy as sa


revision = "i7f8a9b0c1d2"
down_revision = "h6e7f8a9b0c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "clients",
        "email",
        existing_type=sa.String(length=100),
        nullable=True,
    )
    op.alter_column(
        "clients",
        "phone",
        existing_type=sa.String(length=20),
        nullable=True,
    )


def downgrade() -> None:
    op.execute("UPDATE clients SET email = '' WHERE email IS NULL")
    op.execute("UPDATE clients SET phone = '' WHERE phone IS NULL")
    op.alter_column(
        "clients",
        "phone",
        existing_type=sa.String(length=20),
        nullable=False,
    )
    op.alter_column(
        "clients",
        "email",
        existing_type=sa.String(length=100),
        nullable=False,
    )
