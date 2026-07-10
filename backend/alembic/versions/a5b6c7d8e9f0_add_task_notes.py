"""add free-form notes to task items

Revision ID: a5b6c7d8e9f0
Revises: z4q5r6s7t8u9
"""

from alembic import op
import sqlalchemy as sa


revision = "a5b6c7d8e9f0"
down_revision = "z4q5r6s7t8u9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("task_items") as batch:
        batch.add_column(sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("task_items") as batch:
        batch.drop_column("notes")
