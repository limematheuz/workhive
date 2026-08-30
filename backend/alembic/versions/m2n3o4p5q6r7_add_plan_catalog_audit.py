"""add immutable standard-plan publication audit

Revision ID: m2n3o4p5q6r7
Revises: l1m2n3o4p5q6
"""

from alembic import op
import sqlalchemy as sa


revision = "m2n3o4p5q6r7"
down_revision = "l1m2n3o4p5q6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_catalog_audits",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "plan_id",
            sa.Integer(),
            sa.ForeignKey("subscription_plans.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("plan_code", sa.String(length=50), nullable=False),
        sa.Column("plan_version", sa.Integer(), nullable=False),
        sa.Column(
            "actor_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("previous_value", sa.JSON(), nullable=True),
        sa.Column("next_value", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_plan_catalog_audits_plan_id", "plan_catalog_audits", ["plan_id"]
    )
    op.create_index(
        "ix_plan_catalog_audits_plan_code", "plan_catalog_audits", ["plan_code"]
    )
    op.create_index(
        "ix_plan_catalog_audits_actor_user_id",
        "plan_catalog_audits",
        ["actor_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_plan_catalog_audits_actor_user_id", table_name="plan_catalog_audits")
    op.drop_index("ix_plan_catalog_audits_plan_code", table_name="plan_catalog_audits")
    op.drop_index("ix_plan_catalog_audits_plan_id", table_name="plan_catalog_audits")
    op.drop_table("plan_catalog_audits")
