"""Optional lot identity for traceable inventory receipts."""

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class InventoryLot(Base):
    __tablename__ = "inventory_lots"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "material_id",
            "warehouse_id",
            "code",
            name="uq_inventory_lot_company_material_warehouse_code",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
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
    code = Column(String(120), nullable=False)
    expires_at = Column(Date, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    material = relationship("InventoryMaterial")
    warehouse = relationship("InventoryWarehouse")
