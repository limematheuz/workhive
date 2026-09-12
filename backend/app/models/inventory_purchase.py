"""Purchases that connect fiscal expenses with immutable stock receipts."""

from sqlalchemy import (
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
from sqlalchemy.orm import relationship

from app.db.session import Base


class InventoryPurchase(Base):
    __tablename__ = "inventory_purchases"
    __table_args__ = (
        CheckConstraint(
            "status IN ('received', 'reversed')",
            name="ck_inventory_purchase_status",
        ),
        UniqueConstraint("expense_id", name="uq_inventory_purchase_expense_id"),
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
        nullable=False,
        index=True,
    )
    expense_id = Column(
        Integer,
        ForeignKey("expenses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status = Column(String(20), nullable=False, default="received", index=True)
    supplier_name_snapshot = Column(String(160), nullable=False)
    supplier_tax_id_snapshot = Column(String(32), nullable=True)
    reference = Column(String(160), nullable=True)
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    received_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    reversed_at = Column(DateTime(timezone=True), nullable=True)
    reversed_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reversal_reason = Column(Text, nullable=True)

    expense = relationship("Expense", foreign_keys=[expense_id])
    lines = relationship(
        "InventoryPurchaseLine",
        back_populates="purchase",
        cascade="all, delete-orphan",
        order_by="InventoryPurchaseLine.id",
    )


class InventoryPurchaseLine(Base):
    __tablename__ = "inventory_purchase_lines"
    __table_args__ = (
        CheckConstraint(
            "quantity > 0", name="ck_inventory_purchase_line_quantity_positive"
        ),
        CheckConstraint(
            "unit_cost >= 0", name="ck_inventory_purchase_line_unit_cost_nonnegative"
        ),
        UniqueConstraint(
            "purchase_id",
            "material_id",
            "warehouse_id",
            "lot_id",
            name="uq_inventory_purchase_line_material_warehouse_lot",
        ),
        UniqueConstraint(
            "movement_id", name="uq_inventory_purchase_line_movement_id"
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    purchase_id = Column(
        Integer,
        ForeignKey("inventory_purchases.id", ondelete="CASCADE"),
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
    movement_id = Column(
        Integer,
        ForeignKey("inventory_movements.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    lot_id = Column(
        Integer,
        ForeignKey("inventory_lots.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    quantity = Column(Numeric(14, 3), nullable=False)
    unit_cost = Column(Numeric(14, 4), nullable=False)

    purchase = relationship("InventoryPurchase", back_populates="lines")
    material = relationship("InventoryMaterial")
    warehouse = relationship("InventoryWarehouse")
    movement = relationship("InventoryMovement")
    lot = relationship("InventoryLot")
