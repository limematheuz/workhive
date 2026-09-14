"""add direct expense attribution to operational scopes

Revision ID: i0j1k2l3m4n5
Revises: h9i0j1k2l3m4
"""

import sqlalchemy as sa
from alembic import op


revision = "i0j1k2l3m4n5"
down_revision = "h9i0j1k2l3m4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Batch mode is required for post-create foreign keys on SQLite and keeps
    # the production/PostgreSQL and test migration paths equivalent.
    with op.batch_alter_table("expenses") as batch:
        batch.add_column(sa.Column("service_contract_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("work_order_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_expenses_service_contract_id",
            "service_contracts",
            ["service_contract_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_foreign_key(
            "fk_expenses_work_order_id",
            "work_orders",
            ["work_order_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_check_constraint(
            "ck_expense_one_operational_scope",
            "NOT (service_contract_id IS NOT NULL AND work_order_id IS NOT NULL)",
        )
    op.create_index(
        "ix_expenses_service_contract_id", "expenses", ["service_contract_id"]
    )
    op.create_index("ix_expenses_work_order_id", "expenses", ["work_order_id"])


def downgrade() -> None:
    op.drop_index("ix_expenses_work_order_id", table_name="expenses")
    op.drop_index("ix_expenses_service_contract_id", table_name="expenses")
    with op.batch_alter_table("expenses") as batch:
        batch.drop_constraint("ck_expense_one_operational_scope", type_="check")
        batch.drop_constraint("fk_expenses_work_order_id", type_="foreignkey")
        batch.drop_constraint("fk_expenses_service_contract_id", type_="foreignkey")
        batch.drop_column("work_order_id")
        batch.drop_column("service_contract_id")
