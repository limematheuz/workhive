"""add company subscription state

Revision ID: o3f4a5b6c7d8
Revises: p4g5h6b7c8d9
"""

from alembic import op
import sqlalchemy as sa


revision = "o3f4a5b6c7d8"
down_revision = "p4g5h6b7c8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("session_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "companies",
        sa.Column("subscription_plan", sa.String(length=30), nullable=False, server_default="none"),
    )
    op.add_column(
        "companies",
        sa.Column("subscription_status", sa.String(length=30), nullable=False, server_default="inactive"),
    )
    op.add_column("companies", sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("companies", sa.Column("stripe_customer_id", sa.String(length=100), nullable=True))
    op.add_column("companies", sa.Column("stripe_subscription_id", sa.String(length=100), nullable=True))
    op.create_index("ix_companies_subscription_status", "companies", ["subscription_status"])
    op.create_index("ix_companies_stripe_customer_id", "companies", ["stripe_customer_id"], unique=True)
    op.create_index(
        "ix_companies_stripe_subscription_id",
        "companies",
        ["stripe_subscription_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_companies_stripe_subscription_id", table_name="companies")
    op.drop_index("ix_companies_stripe_customer_id", table_name="companies")
    op.drop_index("ix_companies_subscription_status", table_name="companies")
    op.drop_column("companies", "stripe_subscription_id")
    op.drop_column("companies", "stripe_customer_id")
    op.drop_column("companies", "trial_ends_at")
    op.drop_column("companies", "subscription_status")
    op.drop_column("companies", "subscription_plan")
    op.drop_column("users", "session_version")
