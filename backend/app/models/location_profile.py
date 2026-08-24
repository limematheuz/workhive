from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class LocationProfile(Base):
    __tablename__ = "location_profiles"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "internal_code",
            name="uq_location_profiles_company_internal_code",
        ),
    )

    location_id = Column(
        Integer,
        ForeignKey("locations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    site_type = Column(String(50), nullable=False, default="other")
    internal_code = Column(String(80), nullable=True)
    site_reference = Column(String(120), nullable=True)
    contact_name = Column(String(120), nullable=True)
    contact_phone = Column(String(40), nullable=True)
    contact_email = Column(String(254), nullable=True)
    service_notes = Column(Text, nullable=True)
    attributes = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    location = relationship("Location", back_populates="profile")
