from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class LocationCompanyAccess(Base):
    __tablename__ = "location_company_access"

    location_id = Column(
        Integer, ForeignKey("locations.id", ondelete="CASCADE"), primary_key=True
    )
    company_id = Column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True
    )
    relationship_type = Column(String(30), nullable=False, default="service_provider")
    can_manage_reservations = Column(Boolean, nullable=False, default=False)
    can_manage_tasks = Column(Boolean, nullable=False, default=False)
    can_view_sensitive = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    location = relationship("Location", back_populates="company_access")
    company = relationship("Company", back_populates="location_access")
