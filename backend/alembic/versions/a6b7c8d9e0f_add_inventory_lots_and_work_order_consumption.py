"""add inventory lots and work-order consumption

Revision ID: a6b7c8d9e0f
Revises: f5a6b7c8d9e
"""

import sqlalchemy as sa
from alembic import op


revision = "a6b7c8d9e0f"
down_revision = "f5a6b7c8d9e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inventory_lots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
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
        sa.Column("code", sa.String(length=120), nullable=False),
        sa.Column("expires_at", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "company_id",
            "material_id",
            "warehouse_id",
            "code",
            name="uq_inventory_lot_company_material_warehouse_code",
        ),
    )
    for column in ("company_id", "material_id", "warehouse_id", "expires_at"):
        op.create_index(f"ix_inventory_lots_{column}", "inventory_lots", [column])

    # Existing tables must use batch mode so the full migration path remains
    # executable on SQLite (used by the migration regression suite).
    with op.batch_alter_table("inventory_movements") as batch:
        batch.add_column(sa.Column("lot_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("work_order_id", sa.Integer(), nullable=True))
        batch.add_column(
            sa.Column("reversal_of_movement_id", sa.Integer(), nullable=True)
        )
        batch.create_foreign_key(
            "fk_inventory_movements_lot_id",
            "inventory_lots",
            ["lot_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        batch.create_foreign_key(
            "fk_inventory_movements_work_order_id",
            "work_orders",
            ["work_order_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        batch.create_foreign_key(
            "fk_inventory_movements_reversal_of_movement_id",
            "inventory_movements",
            ["reversal_of_movement_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_unique_constraint(
            "uq_inventory_movement_reversal_of_movement_id",
            ["reversal_of_movement_id"],
        )
    for column in ("lot_id", "work_order_id", "reversal_of_movement_id"):
        op.create_index(
            f"ix_inventory_movements_{column}", "inventory_movements", [column]
        )

    # Do not reflect transitive purchase FKs here: the historical migration
    # fixture deliberately keeps `expenses` minimal, while this table's source
    # shape is known and fixed by the preceding revision.
    purchase_lines = sa.Table(
        "inventory_purchase_lines",
        sa.MetaData(),
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("purchase_id", sa.Integer(), nullable=False),
        sa.Column("material_id", sa.Integer(), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), nullable=False),
        sa.Column("movement_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("unit_cost", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.ForeignKeyConstraint(
            ["purchase_id"], ["inventory_purchases.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["material_id"], ["inventory_materials.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["warehouse_id"], ["inventory_warehouses.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["movement_id"], ["inventory_movements.id"], ondelete="RESTRICT"
        ),
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
        sa.Index("ix_inventory_purchase_lines_purchase_id", "purchase_id"),
        sa.Index("ix_inventory_purchase_lines_material_id", "material_id"),
        sa.Index("ix_inventory_purchase_lines_warehouse_id", "warehouse_id"),
        sa.Index("ix_inventory_purchase_lines_movement_id", "movement_id"),
    )
    with op.batch_alter_table(
        "inventory_purchase_lines", copy_from=purchase_lines
    ) as batch:
        batch.add_column(sa.Column("lot_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_inventory_purchase_lines_lot_id",
            "inventory_lots",
            ["lot_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        batch.drop_constraint(
            "uq_inventory_purchase_line_material_warehouse", type_="unique"
        )
        batch.create_unique_constraint(
            "uq_inventory_purchase_line_material_warehouse_lot",
            ["purchase_id", "material_id", "warehouse_id", "lot_id"],
        )
    op.create_index(
        "ix_inventory_purchase_lines_lot_id", "inventory_purchase_lines", ["lot_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_inventory_purchase_lines_lot_id", table_name="inventory_purchase_lines")
    with op.batch_alter_table("inventory_purchase_lines") as batch:
        batch.drop_constraint(
            "uq_inventory_purchase_line_material_warehouse_lot", type_="unique"
        )
        batch.create_unique_constraint(
            "uq_inventory_purchase_line_material_warehouse",
            ["purchase_id", "material_id", "warehouse_id"],
        )
        batch.drop_constraint("fk_inventory_purchase_lines_lot_id", type_="foreignkey")
        batch.drop_column("lot_id")

    for column in ("reversal_of_movement_id", "work_order_id", "lot_id"):
        op.drop_index(f"ix_inventory_movements_{column}", table_name="inventory_movements")
    with op.batch_alter_table("inventory_movements") as batch:
        batch.drop_constraint(
            "uq_inventory_movement_reversal_of_movement_id", type_="unique"
        )
        batch.drop_constraint(
            "fk_inventory_movements_reversal_of_movement_id", type_="foreignkey"
        )
        batch.drop_constraint(
            "fk_inventory_movements_work_order_id", type_="foreignkey"
        )
        batch.drop_constraint("fk_inventory_movements_lot_id", type_="foreignkey")
        for column in ("reversal_of_movement_id", "work_order_id", "lot_id"):
            batch.drop_column(column)

    for column in ("expires_at", "warehouse_id", "material_id", "company_id"):
        op.drop_index(f"ix_inventory_lots_{column}", table_name="inventory_lots")
    op.drop_table("inventory_lots")
