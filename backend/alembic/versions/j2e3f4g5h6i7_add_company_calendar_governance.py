"""add company calendar governance

Revision ID: j2e3f4g5h6i7
Revises: i1d2e3f4g5h6
"""

from alembic import op
import sqlalchemy as sa


revision = "j2e3f4g5h6i7"
down_revision = "i1d2e3f4g5h6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_calendar_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "company_connections_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["updated_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        sa.text(
            "INSERT INTO platform_calendar_config "
            "(id, company_connections_enabled) VALUES (1, true)"
        )
    )

    op.create_table(
        "company_calendar_settings",
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("company_id"),
    )
    op.create_index(
        "ix_company_calendar_settings_owner_user_id",
        "company_calendar_settings",
        ["owner_user_id"],
    )

    op.create_table(
        "calendar_ownership_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("requester_user_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("reviewed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'cancelled')",
            name="ck_calendar_ownership_request_status",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["requester_user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_calendar_ownership_requests_company_id",
        "calendar_ownership_requests",
        ["company_id"],
    )
    op.create_index(
        "ix_calendar_ownership_requests_requester_user_id",
        "calendar_ownership_requests",
        ["requester_user_id"],
    )
    op.create_index(
        "ix_calendar_ownership_requests_status",
        "calendar_ownership_requests",
        ["status"],
    )
    op.create_index(
        "uq_calendar_ownership_pending_requester",
        "calendar_ownership_requests",
        ["company_id", "requester_user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
        sqlite_where=sa.text("status = 'pending'"),
    )

    # Connections created by roles that can no longer own a company calendar
    # are removed. WorkHive tasks remain untouched and an admin can reconnect.
    op.execute(
        """
        DELETE FROM task_calendar_events
        WHERE EXISTS (
            SELECT 1
            FROM google_calendar_connections
            WHERE google_calendar_connections.company_id = task_calendar_events.company_id
              AND google_calendar_connections.owner_user_id = task_calendar_events.user_id
              AND NOT EXISTS (
                  SELECT 1
                  FROM users
                  JOIN roles ON roles.id = users.role_id
                  WHERE users.id = google_calendar_connections.owner_user_id
                    AND users.company_id = google_calendar_connections.company_id
                    AND users.is_active = true
                    AND roles.name = 'admin'
              )
        )
        """
    )
    op.execute(
        """
        DELETE FROM calendar_sync_jobs
        WHERE EXISTS (
            SELECT 1
            FROM google_calendar_connections
            WHERE google_calendar_connections.company_id = calendar_sync_jobs.company_id
              AND google_calendar_connections.owner_user_id = calendar_sync_jobs.user_id
              AND NOT EXISTS (
                  SELECT 1
                  FROM users
                  JOIN roles ON roles.id = users.role_id
                  WHERE users.id = google_calendar_connections.owner_user_id
                    AND users.company_id = google_calendar_connections.company_id
                    AND users.is_active = true
                    AND roles.name = 'admin'
              )
        )
        """
    )
    op.execute(
        """
        DELETE FROM google_calendar_connections
        WHERE NOT EXISTS (
            SELECT 1
            FROM users
            JOIN roles ON roles.id = users.role_id
            WHERE users.id = google_calendar_connections.owner_user_id
              AND users.company_id = google_calendar_connections.company_id
              AND users.is_active = true
              AND roles.name = 'admin'
        )
        """
    )

    op.execute(
        """
        INSERT INTO company_calendar_settings (company_id, owner_user_id)
        SELECT companies.id,
               COALESCE(
                   (
                       SELECT google_calendar_connections.owner_user_id
                       FROM google_calendar_connections
                       WHERE google_calendar_connections.company_id = companies.id
                       ORDER BY google_calendar_connections.id
                       LIMIT 1
                   ),
                   (
                       SELECT users.id
                       FROM users
                       JOIN roles ON roles.id = users.role_id
                       WHERE users.company_id = companies.id
                         AND users.is_active = true
                         AND roles.name = 'admin'
                       ORDER BY users.id
                       LIMIT 1
                   )
               )
        FROM companies
        WHERE COALESCE(
            (
                SELECT google_calendar_connections.owner_user_id
                FROM google_calendar_connections
                WHERE google_calendar_connections.company_id = companies.id
                ORDER BY google_calendar_connections.id
                LIMIT 1
            ),
            (
                SELECT users.id
                FROM users
                JOIN roles ON roles.id = users.role_id
                WHERE users.company_id = companies.id
                  AND users.is_active = true
                  AND roles.name = 'admin'
                ORDER BY users.id
                LIMIT 1
            )
        ) IS NOT NULL
        """
    )

    op.execute(
        """
        DELETE FROM task_calendar_events
        WHERE EXISTS (
            SELECT 1
            FROM google_calendar_connections
            WHERE google_calendar_connections.company_id = task_calendar_events.company_id
              AND google_calendar_connections.owner_user_id = task_calendar_events.user_id
              AND google_calendar_connections.id <> (
                  SELECT MIN(keeper.id)
                  FROM google_calendar_connections AS keeper
                  WHERE keeper.company_id = google_calendar_connections.company_id
              )
        )
        """
    )
    op.execute(
        """
        DELETE FROM calendar_sync_jobs
        WHERE EXISTS (
            SELECT 1
            FROM google_calendar_connections
            WHERE google_calendar_connections.company_id = calendar_sync_jobs.company_id
              AND google_calendar_connections.owner_user_id = calendar_sync_jobs.user_id
              AND google_calendar_connections.id <> (
                  SELECT MIN(keeper.id)
                  FROM google_calendar_connections AS keeper
                  WHERE keeper.company_id = google_calendar_connections.company_id
              )
        )
        """
    )
    op.execute(
        """
        DELETE FROM google_calendar_connections
        WHERE id <> (
            SELECT MIN(keeper.id)
            FROM google_calendar_connections AS keeper
            WHERE keeper.company_id = google_calendar_connections.company_id
        )
        """
    )
    with op.batch_alter_table("google_calendar_connections") as batch:
        batch.drop_constraint("uq_google_calendar_company_user", type_="unique")
        batch.create_unique_constraint(
            "uq_google_calendar_company",
            ["company_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("google_calendar_connections") as batch:
        batch.drop_constraint("uq_google_calendar_company", type_="unique")
        batch.create_unique_constraint(
            "uq_google_calendar_company_user",
            ["company_id", "owner_user_id"],
        )

    op.drop_index(
        "uq_calendar_ownership_pending_requester",
        table_name="calendar_ownership_requests",
    )
    op.drop_index(
        "ix_calendar_ownership_requests_status",
        table_name="calendar_ownership_requests",
    )
    op.drop_index(
        "ix_calendar_ownership_requests_requester_user_id",
        table_name="calendar_ownership_requests",
    )
    op.drop_index(
        "ix_calendar_ownership_requests_company_id",
        table_name="calendar_ownership_requests",
    )
    op.drop_table("calendar_ownership_requests")
    op.drop_index(
        "ix_company_calendar_settings_owner_user_id",
        table_name="company_calendar_settings",
    )
    op.drop_table("company_calendar_settings")
    op.drop_table("platform_calendar_config")
