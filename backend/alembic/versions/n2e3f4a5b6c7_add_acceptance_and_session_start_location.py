"""add task acceptance and work session start location

Revision ID: n2e3f4a5b6c7
Revises: m1d2e3f4a5b6
"""

from alembic import op
import sqlalchemy as sa


revision = "n2e3f4a5b6c7"
down_revision = "m1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "task_items",
        sa.Column("accepted_by_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_task_items_accepted_by_user_id",
        "task_items",
        "users",
        ["accepted_by_user_id"],
        ["id"],
    )
    op.add_column(
        "work_sessions",
        sa.Column("start_latitude", sa.Float(), nullable=True),
    )
    op.add_column(
        "work_sessions",
        sa.Column("start_longitude", sa.Float(), nullable=True),
    )
    op.add_column(
        "work_sessions",
        sa.Column("start_accuracy_meters", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("work_sessions", "start_accuracy_meters")
    op.drop_column("work_sessions", "start_longitude")
    op.drop_column("work_sessions", "start_latitude")
    op.drop_constraint(
        "fk_task_items_accepted_by_user_id",
        "task_items",
        type_="foreignkey",
    )
    op.drop_column("task_items", "accepted_by_user_id")
