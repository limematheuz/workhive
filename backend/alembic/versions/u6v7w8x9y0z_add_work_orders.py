"""add work orders without replacing task items

Revision ID: u6v7w8x9y0z
Revises: t5u6v7w8x9y
"""

import sqlalchemy as sa
from alembic import op


revision = "u6v7w8x9y0z"
down_revision = "t5u6v7w8x9y"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("order_type", sa.String(length=20), nullable=False, server_default="one_off"),
        sa.Column("scheduled_start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_occurrence_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recurrence_unit", sa.String(length=20), nullable=True),
        sa.Column("recurrence_interval", sa.Integer(), nullable=True),
        sa.Column("recurrence_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("estimated_people", sa.Integer(), nullable=True),
        sa.Column("estimated_minutes", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("location_id", sa.Integer(), sa.ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("service_contract_id", sa.Integer(), sa.ForeignKey("service_contracts.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.CheckConstraint("status IN ('draft', 'active', 'paused', 'completed', 'cancelled')", name="ck_work_order_status"),
        sa.CheckConstraint("order_type IN ('one_off', 'recurring')", name="ck_work_order_type"),
        sa.CheckConstraint("recurrence_unit IS NULL OR recurrence_unit IN ('weekly', 'monthly')", name="ck_work_order_recurrence_unit"),
        sa.CheckConstraint("recurrence_interval IS NULL OR recurrence_interval > 0", name="ck_work_order_recurrence_interval"),
    )
    for column in (
        "status",
        "order_type",
        "scheduled_start_at",
        "next_occurrence_at",
        "company_id",
        "location_id",
        "service_contract_id",
    ):
        op.create_index(f"ix_work_orders_{column}", "work_orders", [column])
    op.add_column(
        "task_items",
        sa.Column("work_order_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_task_items_work_order_id",
        "task_items",
        "work_orders",
        ["work_order_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_task_items_work_order_id", "task_items", ["work_order_id"])


def downgrade() -> None:
    op.drop_index("ix_task_items_work_order_id", table_name="task_items")
    op.drop_constraint("fk_task_items_work_order_id", "task_items", type_="foreignkey")
    op.drop_column("task_items", "work_order_id")
    op.drop_table("work_orders")
