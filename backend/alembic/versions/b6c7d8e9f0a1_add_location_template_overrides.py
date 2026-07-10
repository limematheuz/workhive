"""add location template overrides

Revision ID: b6c7d8e9f0a1
Revises: a5b6c7d8e9f0
"""

from alembic import op
import sqlalchemy as sa


revision = "b6c7d8e9f0a1"
down_revision = "a5b6c7d8e9f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("location_templates") as batch:
        batch.add_column(sa.Column("custom_name", sa.String(length=200), nullable=True))
        batch.add_column(sa.Column("custom_description", sa.Text(), nullable=True))
        batch.add_column(sa.Column("custom_unit", sa.String(length=50), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("location_templates") as batch:
        batch.drop_column("custom_unit")
        batch.drop_column("custom_description")
        batch.drop_column("custom_name")
