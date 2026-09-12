"""Company-owned inventory catalogue and immutable stock ledger."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)

from app.db.session import Base


class InventorySupplier(Base):
    __tablename__ = "inventory_suppliers"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "name", name="uq_inventory_supplier_company_name"
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(160), nullable=False)
    tax_id = Column(String(32), nullable=True)
    contact_name = Column(String(160), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(32), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class InventoryMaterial(Base):
    __tablename__ = "inventory_materials"
    __table_args__ = (
        UniqueConstraint("company_id", "sku", name="uq_inventory_material_company_sku"),
        CheckConstraint(
            "unit IN ('unit', 'liter', 'kilogram', 'box', 'package')",
            name="ck_inventory_material_unit",
        ),
        CheckConstraint(
            "reorder_point >= 0", name="ck_inventory_material_reorder_point_nonnegative"
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    supplier_id = Column(
        Integer,
        ForeignKey("inventory_suppliers.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    sku = Column(String(80), nullable=False)
    name = Column(String(160), nullable=False, index=True)
    description = Column(Text, nullable=True)
    unit = Column(String(20), nullable=False, default="unit")
    reorder_point = Column(Numeric(14, 3), nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class InventoryWarehouse(Base):
    __tablename__ = "inventory_warehouses"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "name", name="uq_inventory_warehouse_company_name"
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(160), nullable=False)
    address = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    __table_args__ = (
        CheckConstraint(
            "movement_type IN ('receipt', 'issue', 'adjustment_in', 'adjustment_out')",
            name="ck_inventory_movement_type",
        ),
        CheckConstraint("quantity > 0", name="ck_inventory_movement_quantity_positive"),
        CheckConstraint(
            "unit_cost IS NULL OR unit_cost >= 0",
            name="ck_inventory_movement_unit_cost_nonnegative",
        ),
        UniqueConstraint(
            "reversal_of_movement_id",
            name="uq_inventory_movement_reversal_of_movement_id",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    material_id = Column(
        Integer,
        ForeignKey("inventory_materials.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    warehouse_id = Column(
        Integer,
        ForeignKey("inventory_warehouses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    lot_id = Column(
        Integer,
        ForeignKey("inventory_lots.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    work_order_id = Column(
        Integer,
        ForeignKey("work_orders.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    reversal_of_movement_id = Column(
        Integer,
        # A reversal remains immutable in application flows.  SET NULL only
        # covers physical parent cleanup (not exposed by the ledger API) and
        # keeps SQLite able to remove a self-referencing test table.
        ForeignKey("inventory_movements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    movement_type = Column(String(20), nullable=False, index=True)
    quantity = Column(Numeric(14, 3), nullable=False)
    unit_cost = Column(Numeric(14, 4), nullable=True)
    reference = Column(String(160), nullable=True)
    notes = Column(Text, nullable=True)
    recorded_by_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
