"""cleanup inactive location template assignments

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-06-06 16:10:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM location_templates
        WHERE template_task_id IN (
            SELECT id
            FROM template_tasks
            WHERE is_active IS FALSE
        )
        """
    )


def downgrade() -> None:
    # Deleted associations cannot be reconstructed reliably.
    pass
