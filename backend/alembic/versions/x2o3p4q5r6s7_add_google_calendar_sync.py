"""add Google Calendar synchronization

Revision ID: x2o3p4q5r6s7
Revises: w1n2o3p4q5r6
"""

from alembic import op
import sqlalchemy as sa


revision = "x2o3p4q5r6s7"
down_revision = "w1n2o3p4q5r6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "google_calendar_connections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "connected_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("google_account_email", sa.String(length=255), nullable=True),
        sa.Column("calendar_id", sa.String(length=1024), nullable=False),
        sa.Column("calendar_name", sa.String(length=255), nullable=False),
        sa.Column("access_token_encrypted", sa.Text(), nullable=False),
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sync_token", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=30),
            server_default="connected",
            nullable=False,
        ),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", name="uq_google_calendar_company"),
    )
    op.create_index(
        "ix_google_calendar_connections_company_id",
        "google_calendar_connections",
        ["company_id"],
    )

    op.create_table(
        "task_calendar_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("task_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("external_event_id", sa.String(length=1024), nullable=False),
        sa.Column("external_html_link", sa.Text(), nullable=True),
        sa.Column("etag", sa.String(length=255), nullable=True),
        sa.Column("google_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_task_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.String(length=30),
            server_default="active",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "company_id",
            "task_id",
            name="uq_calendar_event_company_task",
        ),
        sa.UniqueConstraint(
            "company_id",
            "external_event_id",
            name="uq_calendar_event_company_external",
        ),
    )
    op.create_index(
        "ix_task_calendar_events_company_id",
        "task_calendar_events",
        ["company_id"],
    )
    op.create_index(
        "ix_task_calendar_events_task_id",
        "task_calendar_events",
        ["task_id"],
    )

    op.create_table(
        "calendar_sync_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("task_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("external_event_id", sa.String(length=1024), nullable=True),
        sa.Column("operation", sa.String(length=20), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_calendar_sync_jobs_company_id",
        "calendar_sync_jobs",
        ["company_id"],
    )
    op.create_index(
        "ix_calendar_sync_jobs_task_id",
        "calendar_sync_jobs",
        ["task_id"],
    )
    op.create_index(
        "ix_calendar_sync_jobs_status",
        "calendar_sync_jobs",
        ["status"],
    )


def downgrade() -> None:
    op.drop_table("calendar_sync_jobs")
    op.drop_table("task_calendar_events")
    op.drop_table("google_calendar_connections")
