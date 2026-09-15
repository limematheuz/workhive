"""add explicit margin forecasts

Revision ID: h9i0j1k2l3m4
Revises: g8h9i0j1k2l3
"""

import sqlalchemy as sa
from alembic import op


revision = "h9i0j1k2l3m4"
down_revision = "g8h9i0j1k2l3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "margin_forecasts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("service_contract_id", sa.Integer(), nullable=True),
        sa.Column("work_order_id", sa.Integer(), nullable=True),
        sa.Column("planned_direct_cost_amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "(service_contract_id IS NOT NULL AND work_order_id IS NULL) "
            "OR (service_contract_id IS NULL AND work_order_id IS NOT NULL)",
            name="ck_margin_forecast_one_scope",
        ),
        sa.CheckConstraint(
            "planned_direct_cost_amount >= 0",
            name="ck_margin_forecast_cost_nonnegative",
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["service_contract_id"], ["service_contracts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("service_contract_id", name="uq_margin_forecast_service_contract_id"),
        sa.UniqueConstraint("work_order_id", name="uq_margin_forecast_work_order_id"),
    )
    op.create_index("ix_margin_forecasts_company_id", "margin_forecasts", ["company_id"])
    op.create_index(
        "ix_margin_forecasts_service_contract_id",
        "margin_forecasts",
        ["service_contract_id"],
    )
    op.create_index(
        "ix_margin_forecasts_work_order_id",
        "margin_forecasts",
        ["work_order_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_margin_forecasts_work_order_id", table_name="margin_forecasts")
    op.drop_index("ix_margin_forecasts_service_contract_id", table_name="margin_forecasts")
    op.drop_index("ix_margin_forecasts_company_id", table_name="margin_forecasts")
    op.drop_table("margin_forecasts")
