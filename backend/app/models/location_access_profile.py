from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class LocationAccessProfile(Base):
    """Operational access details kept separate from the public location record."""

    __tablename__ = "location_access_profiles"

    location_id = Column(
        Integer,
        ForeignKey("locations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    permitted_days = Column(JSON, nullable=False, default=list)
    permitted_from = Column(String(5), nullable=True)
    permitted_until = Column(String(5), nullable=True)
    requires_outside_hours_authorization = Column(Boolean, nullable=False, default=False)
    access_method = Column(String(50), nullable=True)
    keys_available = Column(Boolean, nullable=True)
    keys_location = Column(String(160), nullable=True)
    key_custodian = Column(String(120), nullable=True)
    instructions = Column(Text, nullable=True)
    access_code_encrypted = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    location = relationship("Location", back_populates="access_profile")

    @property
    def has_access_code(self) -> bool:
        return bool(self.access_code_encrypted)
