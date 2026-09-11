from sqlalchemy import Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class LocationEquipment(Base):
    __tablename__ = "location_equipment"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_location_equipment_quantity_positive"),
        CheckConstraint("status IN ('active', 'maintenance', 'retired')", name="ck_location_equipment_status"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(160), nullable=False)
    category = Column(String(60), nullable=False, default="other", index=True)
    serial_number = Column(String(120), nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    status = Column(String(20), nullable=False, default="active", index=True)
    next_service_at = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    location = relationship("Location", back_populates="equipment")
