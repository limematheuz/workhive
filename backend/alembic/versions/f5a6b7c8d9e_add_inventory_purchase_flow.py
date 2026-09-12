"""add inventory purchase flow

Revision ID: f5a6b7c8d9e
Revises: e4f5a6b7c8d
"""

import sqlalchemy as sa
from alembic import op


revision = "f5a6b7c8d9e"
down_revision = "e4f5a6b7c8d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inventory_purchases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "supplier_id",
            sa.Integer(),
            sa.ForeignKey("inventory_suppliers.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "expense_id",
            sa.Integer(),
            sa.ForeignKey("expenses.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="received"),
        sa.Column("supplier_name_snapshot", sa.String(length=160), nullable=False),
        sa.Column("supplier_tax_id_snapshot", sa.String(length=32), nullable=True),
        sa.Column("reference", sa.String(length=160), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("reversed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "reversed_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reversal_reason", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "status IN ('received', 'reversed')",
            name="ck_inventory_purchase_status",
        ),
        sa.UniqueConstraint("expense_id", name="uq_inventory_purchase_expense_id"),
    )
    for column in (
        "company_id",
        "supplier_id",
        "expense_id",
        "status",
        "created_by_user_id",
        "reversed_by_user_id",
    ):
        op.create_index(
            f"ix_inventory_purchases_{column}", "inventory_purchases", [column]
        )

    op.create_table(
        "inventory_purchase_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "purchase_id",
            sa.Integer(),
            sa.ForeignKey("inventory_purchases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "material_id",
            sa.Integer(),
            sa.ForeignKey("inventory_materials.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "warehouse_id",
            sa.Integer(),
            sa.ForeignKey("inventory_warehouses.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "movement_id",
            sa.Integer(),
            sa.ForeignKey("inventory_movements.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("unit_cost", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.CheckConstraint(
            "quantity > 0", name="ck_inventory_purchase_line_quantity_positive"
        ),
        sa.CheckConstraint(
            "unit_cost >= 0", name="ck_inventory_purchase_line_unit_cost_nonnegative"
        ),
        sa.UniqueConstraint(
            "purchase_id",
            "material_id",
            "warehouse_id",
            name="uq_inventory_purchase_line_material_warehouse",
        ),
        sa.UniqueConstraint("movement_id", name="uq_inventory_purchase_line_movement_id"),
    )
    for column in ("purchase_id", "material_id", "warehouse_id", "movement_id"):
        op.create_index(
            f"ix_inventory_purchase_lines_{column}", "inventory_purchase_lines", [column]
        )


def downgrade() -> None:
    for column in ("purchase_id", "material_id", "warehouse_id", "movement_id"):
        op.drop_index(
            f"ix_inventory_purchase_lines_{column}",
            table_name="inventory_purchase_lines",
        )
    op.drop_table("inventory_purchase_lines")

    for column in (
        "company_id",
        "supplier_id",
        "expense_id",
        "status",
        "created_by_user_id",
        "reversed_by_user_id",
    ):
        op.drop_index(
            f"ix_inventory_purchases_{column}", table_name="inventory_purchases"
        )
    op.drop_table("inventory_purchases")
