"""add work session corrections

Revision ID: x9y0z1a2b3c
Revises: w8x9y0z1a2b
Create Date: 2026-09-11
"""

import sqlalchemy as sa
from alembic import op


revision = "x9y0z1a2b3c"
down_revision = "w8x9y0z1a2b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_session_corrections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("work_session_id", sa.Integer(), nullable=False),
        sa.Column("requested_by_user_id", sa.Integer(), nullable=True),
        sa.Column("original_start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("original_end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requested_start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requested_end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("reviewed_by_user_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="ck_work_session_corrections_status",
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["work_session_id"], ["work_sessions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["requested_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_work_session_corrections_company_id",
        "work_session_corrections",
        ["company_id"],
    )
    op.create_index(
        "ix_work_session_corrections_work_session_id",
        "work_session_corrections",
        ["work_session_id"],
    )
    op.create_index(
        "ix_work_session_corrections_requested_by_user_id",
        "work_session_corrections",
        ["requested_by_user_id"],
    )
    op.create_index(
        "ix_work_session_corrections_reviewed_by_user_id",
        "work_session_corrections",
        ["reviewed_by_user_id"],
    )
    op.create_index(
        "ix_work_session_corrections_status",
        "work_session_corrections",
        ["status"],
    )
    op.create_index(
        "uq_work_session_corrections_pending_per_session",
        "work_session_corrections",
        ["work_session_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )

    permission_definitions = sa.table(
        "permission_definitions",
        sa.column("code", sa.String),
        sa.column("category", sa.String),
        sa.column("description", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(
        permission_definitions,
        [
            {
                "code": "time.approve",
                "category": "time",
                "description": "Review requested work-time corrections",
                "is_active": True,
            }
        ],
    )
    op.execute(
        """
        INSERT INTO permission_profile_permissions
            (permission_profile_id, permission_definition_id)
        SELECT profiles.id, definitions.id
        FROM permission_profiles AS profiles
        JOIN permission_definitions AS definitions
          ON definitions.code = 'time.approve'
        WHERE profiles.name = 'Administrador de empresa'
          AND NOT EXISTS (
            SELECT 1
            FROM permission_profile_permissions AS existing
            WHERE existing.permission_profile_id = profiles.id
              AND existing.permission_definition_id = definitions.id
          )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM permission_profile_permissions
        WHERE permission_definition_id IN (
            SELECT id FROM permission_definitions WHERE code = 'time.approve'
        )
        """
    )
    op.execute("DELETE FROM permission_definitions WHERE code = 'time.approve'")
    op.drop_index(
        "uq_work_session_corrections_pending_per_session",
        "work_session_corrections",
    )
    op.drop_index("ix_work_session_corrections_status", "work_session_corrections")
    op.drop_index(
        "ix_work_session_corrections_reviewed_by_user_id",
        "work_session_corrections",
    )
    op.drop_index(
        "ix_work_session_corrections_requested_by_user_id",
        "work_session_corrections",
    )
    op.drop_index(
        "ix_work_session_corrections_work_session_id",
        "work_session_corrections",
    )
    op.drop_index(
        "ix_work_session_corrections_company_id",
        "work_session_corrections",
    )
    op.drop_table("work_session_corrections")
