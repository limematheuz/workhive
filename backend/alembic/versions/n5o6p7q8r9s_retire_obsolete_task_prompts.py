"""Retire historical task prompts that are no longer actionable.

Revision ID: n5o6p7q8r9s
Revises: m4n5o6p7q8r
"""

from alembic import op
import sqlalchemy as sa

revision = "n5o6p7q8r9s"
down_revision = "m4n5o6p7q8r"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text("""
        UPDATE notifications SET read_at = CURRENT_TIMESTAMP
        WHERE read_at IS NULL AND entity_type = 'task_item'
          AND entity_id IS NOT NULL
          AND event_type IN ('task.assigned', 'task.requested')
          AND NOT EXISTS (
            SELECT 1 FROM task_items
            WHERE task_items.id = notifications.entity_id
              AND task_items.company_id = notifications.company_id
              AND (
                (notifications.event_type = 'task.assigned'
                 AND task_items.status NOT IN ('requested', 'rejected', 'completed'))
                OR (notifications.event_type = 'task.requested'
                    AND task_items.status = 'requested')
              )
          )
    """)
    )


def downgrade() -> None:
    # Read history cannot be safely reversed: users may also have read notices.
    pass
