"""make Google Calendar synchronization user scoped

Revision ID: z4q5r6s7t8u9
Revises: y3p4q5r6s7t8
"""

from alembic import op
import sqlalchemy as sa


revision = "z4q5r6s7t8u9"
down_revision = "y3p4q5r6s7t8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("google_calendar_connections") as batch:
        batch.add_column(
            sa.Column(
                "owner_user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=True,
            )
        )
    op.execute(
        """
        UPDATE google_calendar_connections
        SET owner_user_id = connected_by_user_id
        WHERE owner_user_id IS NULL
        """
    )
    with op.batch_alter_table("google_calendar_connections") as batch:
        batch.alter_column("owner_user_id", nullable=False)
        batch.drop_constraint("uq_google_calendar_company", type_="unique")
        batch.create_unique_constraint(
            "uq_google_calendar_company_user",
            ["company_id", "owner_user_id"],
        )
        batch.create_index(
            "ix_google_calendar_connections_owner_user_id",
            ["owner_user_id"],
        )

    with op.batch_alter_table("task_calendar_events") as batch:
        batch.add_column(
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=True,
            )
        )
    op.execute(
        """
        UPDATE task_calendar_events
        SET user_id = (
            SELECT task_items.user_id
            FROM task_items
            WHERE task_items.id = task_calendar_events.task_id
        )
        WHERE user_id IS NULL AND task_id IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE task_calendar_events
        SET user_id = (
            SELECT google_calendar_connections.owner_user_id
            FROM google_calendar_connections
            WHERE google_calendar_connections.company_id = task_calendar_events.company_id
            LIMIT 1
        )
        WHERE user_id IS NULL
        """
    )
    op.execute("DELETE FROM task_calendar_events WHERE user_id IS NULL")
    with op.batch_alter_table("task_calendar_events") as batch:
        batch.alter_column("user_id", nullable=False)
        batch.drop_constraint("uq_calendar_event_company_task", type_="unique")
        batch.drop_constraint("uq_calendar_event_company_external", type_="unique")
        batch.create_unique_constraint(
            "uq_calendar_event_company_user_task",
            ["company_id", "user_id", "task_id"],
        )
        batch.create_unique_constraint(
            "uq_calendar_event_company_user_external",
            ["company_id", "user_id", "external_event_id"],
        )
        batch.create_index("ix_task_calendar_events_user_id", ["user_id"])

    with op.batch_alter_table("calendar_sync_jobs") as batch:
        batch.add_column(
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=True,
            )
        )
    op.execute(
        """
        UPDATE calendar_sync_jobs
        SET user_id = (
            SELECT task_items.user_id
            FROM task_items
            WHERE task_items.id = calendar_sync_jobs.task_id
        )
        WHERE user_id IS NULL AND task_id IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE calendar_sync_jobs
        SET user_id = (
            SELECT task_calendar_events.user_id
            FROM task_calendar_events
            WHERE task_calendar_events.company_id = calendar_sync_jobs.company_id
              AND task_calendar_events.external_event_id = calendar_sync_jobs.external_event_id
            LIMIT 1
        )
        WHERE user_id IS NULL AND external_event_id IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE calendar_sync_jobs
        SET user_id = (
            SELECT google_calendar_connections.owner_user_id
            FROM google_calendar_connections
            WHERE google_calendar_connections.company_id = calendar_sync_jobs.company_id
            LIMIT 1
        )
        WHERE user_id IS NULL
        """
    )
    op.execute("DELETE FROM calendar_sync_jobs WHERE user_id IS NULL")
    with op.batch_alter_table("calendar_sync_jobs") as batch:
        batch.alter_column("user_id", nullable=False)
        batch.create_index("ix_calendar_sync_jobs_user_id", ["user_id"])


def downgrade() -> None:
    with op.batch_alter_table("calendar_sync_jobs") as batch:
        batch.drop_index("ix_calendar_sync_jobs_user_id")
        batch.drop_column("user_id")

    with op.batch_alter_table("task_calendar_events") as batch:
        batch.drop_index("ix_task_calendar_events_user_id")
        batch.drop_constraint(
            "uq_calendar_event_company_user_external",
            type_="unique",
        )
        batch.drop_constraint(
            "uq_calendar_event_company_user_task",
            type_="unique",
        )
        batch.create_unique_constraint(
            "uq_calendar_event_company_external",
            ["company_id", "external_event_id"],
        )
        batch.create_unique_constraint(
            "uq_calendar_event_company_task",
            ["company_id", "task_id"],
        )
        batch.drop_column("user_id")

    with op.batch_alter_table("google_calendar_connections") as batch:
        batch.drop_index("ix_google_calendar_connections_owner_user_id")
        batch.drop_constraint("uq_google_calendar_company_user", type_="unique")
        batch.create_unique_constraint(
            "uq_google_calendar_company",
            ["company_id"],
        )
        batch.drop_column("owner_user_id")
