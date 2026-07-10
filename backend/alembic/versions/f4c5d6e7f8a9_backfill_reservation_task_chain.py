"""backfill reservation task chain

Revision ID: f4c5d6e7f8a9
Revises: f3b4c5d6e7f8
Create Date: 2026-06-06 20:10:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "f4c5d6e7f8a9"
down_revision: Union[str, None] = "f3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE task_items AS task
        SET
            next_reservation_id = next_stay.id,
            scheduled_start_at = CASE
                WHEN task.scheduled_start_at IS NULL
                    OR task.scheduled_start_at < current_stay.check_out_at
                    OR (
                        next_stay.check_in_at IS NOT NULL
                        AND task.scheduled_start_at > next_stay.check_in_at
                    )
                THEN current_stay.check_out_at
                ELSE task.scheduled_start_at
            END,
            due_at = COALESCE(
                next_stay.check_in_at,
                task.scheduled_start_at,
                current_stay.check_out_at
            )
        FROM reservations AS current_stay
        LEFT JOIN LATERAL (
            SELECT candidate.id, candidate.check_in_at
            FROM reservations AS candidate
            WHERE candidate.location_id = current_stay.location_id
              AND candidate.id <> current_stay.id
              AND candidate.status <> 'cancelled'
              AND candidate.check_in_at >= current_stay.check_out_at
            ORDER BY candidate.check_in_at ASC
            LIMIT 1
        ) AS next_stay ON TRUE
        WHERE task.checkout_reservation_id = current_stay.id
          AND current_stay.status <> 'cancelled'
          AND task.is_invoiced IS FALSE
        """
    )


def downgrade() -> None:
    # The previous reservation links cannot be distinguished from manual links.
    pass
