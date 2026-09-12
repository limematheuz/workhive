"""add company inventory foundation

Revision ID: e4f5a6b7c8d
Revises: d3e4f5a6b7c
"""

import sqlalchemy as sa
from alembic import op


revision = "e4f5a6b7c8d"
down_revision = "d3e4f5a6b7c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "inventory_suppliers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("tax_id", sa.String(length=32), nullable=True),
        sa.Column("contact_name", sa.String(length=160), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "company_id", "name", name="uq_inventory_supplier_company_name"
        ),
    )
    op.create_index(
        "ix_inventory_suppliers_company_id", "inventory_suppliers", ["company_id"]
    )
    op.create_index(
        "ix_inventory_suppliers_is_active", "inventory_suppliers", ["is_active"]
    )

    op.create_table(
        "inventory_materials",
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
            nullable=True,
        ),
        sa.Column("sku", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="unit"),
        sa.Column(
            "reorder_point",
            sa.Numeric(precision=14, scale=3),
            nullable=False,
            server_default="0",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "unit IN ('unit', 'liter', 'kilogram', 'box', 'package')",
            name="ck_inventory_material_unit",
        ),
        sa.CheckConstraint(
            "reorder_point >= 0", name="ck_inventory_material_reorder_point_nonnegative"
        ),
        sa.UniqueConstraint(
            "company_id", "sku", name="uq_inventory_material_company_sku"
        ),
    )
    for column in ("company_id", "supplier_id", "name", "is_active"):
        op.create_index(
            f"ix_inventory_materials_{column}", "inventory_materials", [column]
        )

    op.create_table(
        "inventory_warehouses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Integer(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "company_id", "name", name="uq_inventory_warehouse_company_name"
        ),
    )
    op.create_index(
        "ix_inventory_warehouses_company_id", "inventory_warehouses", ["company_id"]
    )
    op.create_index(
        "ix_inventory_warehouses_is_active", "inventory_warehouses", ["is_active"]
    )

    op.create_table(
        "inventory_movements",
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
        sa.Column("movement_type", sa.String(length=20), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("unit_cost", sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column("reference", sa.String(length=160), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "recorded_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "movement_type IN ('receipt', 'issue', 'adjustment_in', 'adjustment_out')",
            name="ck_inventory_movement_type",
        ),
        sa.CheckConstraint(
            "quantity > 0", name="ck_inventory_movement_quantity_positive"
        ),
        sa.CheckConstraint(
            "unit_cost IS NULL OR unit_cost >= 0",
            name="ck_inventory_movement_unit_cost_nonnegative",
        ),
    )
    for column in (
        "company_id",
        "material_id",
        "warehouse_id",
        "movement_type",
        "recorded_by_user_id",
    ):
        op.create_index(
            f"ix_inventory_movements_{column}", "inventory_movements", [column]
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
                "code": "inventory.read",
                "category": "inventory",
                "description": "View company suppliers, material catalogue, and stock",
                "is_active": True,
            },
            {
                "code": "inventory.manage",
                "category": "inventory",
                "description": "Manage company suppliers, materials, warehouses, and stock movements",
                "is_active": True,
            },
        ],
    )
    op.execute(
        """
        INSERT INTO permission_profile_permissions
            (permission_profile_id, permission_definition_id)
        SELECT profiles.id, definitions.id
        FROM permission_profiles AS profiles
        JOIN permission_definitions AS definitions
          ON definitions.code IN ('inventory.read', 'inventory.manage')
        WHERE profiles.name = 'Administrador de empresa'
          AND NOT EXISTS (
            SELECT 1 FROM permission_profile_permissions AS existing
            WHERE existing.permission_profile_id = profiles.id
              AND existing.permission_definition_id = definitions.id
          )
        """
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM permission_profile_permissions WHERE permission_definition_id IN (SELECT id FROM permission_definitions WHERE code IN ('inventory.read', 'inventory.manage'))"
    )
    op.execute(
        "DELETE FROM permission_definitions WHERE code IN ('inventory.read', 'inventory.manage')"
    )
    for column in (
        "recorded_by_user_id",
        "movement_type",
        "warehouse_id",
        "material_id",
        "company_id",
    ):
        op.drop_index(
            f"ix_inventory_movements_{column}", table_name="inventory_movements"
        )
    op.drop_table("inventory_movements")
    op.drop_index(
        "ix_inventory_warehouses_is_active", table_name="inventory_warehouses"
    )
    op.drop_index(
        "ix_inventory_warehouses_company_id", table_name="inventory_warehouses"
    )
    op.drop_table("inventory_warehouses")
    for column in ("is_active", "name", "supplier_id", "company_id"):
        op.drop_index(
            f"ix_inventory_materials_{column}", table_name="inventory_materials"
        )
    op.drop_table("inventory_materials")
    op.drop_index("ix_inventory_suppliers_is_active", table_name="inventory_suppliers")
    op.drop_index("ix_inventory_suppliers_company_id", table_name="inventory_suppliers")
    op.drop_table("inventory_suppliers")
