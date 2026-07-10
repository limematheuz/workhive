"""add task evidence and work session task link

Revision ID: k9b0c1d2e3f4
Revises: j8a9b0c1d2e3
"""

from alembic import op
import sqlalchemy as sa


revision = "k9b0c1d2e3f4"
down_revision = "j8a9b0c1d2e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "task_items",
        sa.Column(
            "operational_notes",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )
    op.add_column(
        "task_items",
        sa.Column(
            "attachments",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )
    op.add_column(
        "task_items",
        sa.Column(
            "checklist_evidence",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
    op.add_column(
        "work_sessions",
        sa.Column("task_item_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_work_sessions_task_item_id",
        "work_sessions",
        "task_items",
        ["task_item_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_work_sessions_task_item_id", "work_sessions", type_="foreignkey"
    )
    op.drop_column("work_sessions", "task_item_id")
    op.drop_column("task_items", "checklist_evidence")
    op.drop_column("task_items", "attachments")
    op.drop_column("task_items", "operational_notes")
