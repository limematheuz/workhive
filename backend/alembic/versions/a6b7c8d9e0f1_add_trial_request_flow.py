"""add trial request flow

Revision ID: a6b7c8d9e0f1
Revises: f0a1b2c3d4e5
"""

from alembic import op
import sqlalchemy as sa


revision = "a6b7c8d9e0f1"
down_revision = "f0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "companies",
        sa.Column("trial_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "trial_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("company_name", sa.String(length=120), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=40),
            nullable=False,
            server_default="pending_email_verification",
        ),
        sa.Column("verification_token_hash", sa.String(length=64), nullable=False),
        sa.Column("verification_token_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requested_trial_days", sa.Integer(), nullable=True),
        sa.Column("approved_trial_days", sa.Integer(), nullable=True),
        sa.Column("approval_mode", sa.String(length=20), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_company_id", sa.Integer(), nullable=True),
        sa.Column("created_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["approved_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["created_company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["created_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_trial_requests_email", "trial_requests", ["email"])
    op.create_index("ix_trial_requests_status", "trial_requests", ["status"])
    op.create_index(
        "ix_trial_requests_verification_token_hash",
        "trial_requests",
        ["verification_token_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_trial_requests_verification_token_hash", table_name="trial_requests")
    op.drop_index("ix_trial_requests_status", table_name="trial_requests")
    op.drop_index("ix_trial_requests_email", table_name="trial_requests")
    op.drop_table("trial_requests")
    op.drop_column("companies", "trial_started_at")
    op.drop_column("users", "email_verified_at")
