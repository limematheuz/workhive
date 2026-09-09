from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class LocationContact(Base):
    """An operational contact that is relevant to one specific location."""

    __tablename__ = "location_contacts"
    __table_args__ = (
        CheckConstraint(
            "role IN ('operations', 'access', 'emergency', 'quality', 'general')",
            name="ck_location_contact_role",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(
        Integer,
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    full_name = Column(String(120), nullable=False)
    email = Column(String(254), nullable=True)
    phone = Column(String(30), nullable=True)
    role = Column(String(30), nullable=False, default="general", index=True)
    is_primary = Column(Boolean, nullable=False, default=False)
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

    location = relationship("Location", back_populates="contacts")
