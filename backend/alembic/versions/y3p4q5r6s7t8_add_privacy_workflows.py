"""add GDPR consent and data subject request workflows

Revision ID: y3p4q5r6s7t8
Revises: x2o3p4q5r6s7
"""

from alembic import op
import sqlalchemy as sa


revision = "y3p4q5r6s7t8"
down_revision = "x2o3p4q5r6s7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "privacy_consents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("consent_type", sa.String(length=50), nullable=False),
        sa.Column("policy_version", sa.String(length=30), nullable=False),
        sa.Column("accepted", sa.Boolean(), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_privacy_consents_user_id",
        "privacy_consents",
        ["user_id"],
    )
    op.create_index(
        "ix_privacy_consents_company_id",
        "privacy_consents",
        ["company_id"],
    )
    op.create_index(
        "ix_privacy_consents_consent_type",
        "privacy_consents",
        ["consent_type"],
    )

    op.create_table(
        "data_subject_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "requested_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("request_type", sa.String(length=30), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("resolution_notes", sa.Text(), nullable=True),
        sa.Column(
            "resolved_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_data_subject_requests_company_id",
        "data_subject_requests",
        ["company_id"],
    )
    op.create_index(
        "ix_data_subject_requests_requested_by_user_id",
        "data_subject_requests",
        ["requested_by_user_id"],
    )
    op.create_index(
        "ix_data_subject_requests_request_type",
        "data_subject_requests",
        ["request_type"],
    )
    op.create_index(
        "ix_data_subject_requests_status",
        "data_subject_requests",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_data_subject_requests_status",
        table_name="data_subject_requests",
    )
    op.drop_index(
        "ix_data_subject_requests_request_type",
        table_name="data_subject_requests",
    )
    op.drop_index(
        "ix_data_subject_requests_requested_by_user_id",
        table_name="data_subject_requests",
    )
    op.drop_index(
        "ix_data_subject_requests_company_id",
        table_name="data_subject_requests",
    )
    op.drop_table("data_subject_requests")
    op.drop_index(
        "ix_privacy_consents_consent_type",
        table_name="privacy_consents",
    )
    op.drop_index(
        "ix_privacy_consents_company_id",
        table_name="privacy_consents",
    )
    op.drop_index(
        "ix_privacy_consents_user_id",
        table_name="privacy_consents",
    )
    op.drop_table("privacy_consents")
