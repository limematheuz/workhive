"""repair completed normalized checklists from recorded evidence

Revision ID: c9d0e1f2a3b4
Revises: ab1c2d3e4f5a
"""

from collections.abc import Sequence

from alembic import op


revision: str = "c9d0e1f2a3b4"
down_revision: str | None = "ab1c2d3e4f5a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Before the normalized checklist API existed, answers were stored in the
    # JSON evidence snapshot. Preserve those completed actions by materializing
    # them in the relational rows that are now the operational source of truth.
    op.execute(
        """
        UPDATE task_checklist_items AS checklist
        SET completed = TRUE
        FROM task_items AS task
        WHERE task.id = checklist.task_id
          AND checklist.completed = FALSE
          AND COALESCE(
                task.checklist_evidence -> ('item_' || checklist.id::text) ->> 'answer',
                task.checklist_evidence -> ('parsed_' || (checklist.position + 1)::text) ->> 'answer'
              ) IN ('yes', 'no')
        """
    )
    op.execute(
        """
        UPDATE task_checklist_assignments AS assignment
        SET status = 'completed'
        FROM task_checklist_items AS checklist
        WHERE assignment.checklist_item_id = checklist.id
          AND checklist.completed = TRUE
        """
    )
    op.execute(
        """
        UPDATE task_items AS task
        SET status = 'completed',
            date_done = COALESCE(task.date_done, CURRENT_TIMESTAMP)
        WHERE task.status NOT IN ('requested', 'rejected', 'completed')
          AND EXISTS (
              SELECT 1
              FROM task_checklist_items AS checklist
              WHERE checklist.task_id = task.id
          )
          AND NOT EXISTS (
              SELECT 1
              FROM task_checklist_items AS checklist
              WHERE checklist.task_id = task.id
                AND checklist.completed = FALSE
          )
        """
    )
    op.execute(
        """
        UPDATE work_sessions AS session
        SET end_time = CURRENT_TIMESTAMP
        FROM task_items AS task
        WHERE session.task_item_id = task.id
          AND session.end_time IS NULL
          AND task.status = 'completed'
        """
    )


def downgrade() -> None:
    # A historical completion cannot safely be inferred in reverse.
    pass
