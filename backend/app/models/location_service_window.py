from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class LocationServiceWindow(Base):
    """A recurring period when work may be scheduled at one location."""

    __tablename__ = "location_service_windows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(
        Integer,
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label = Column(String(120), nullable=True)
    days = Column(JSON, nullable=False, default=list)
    starts_at = Column(String(5), nullable=False)
    ends_at = Column(String(5), nullable=False)
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

    location = relationship("Location", back_populates="service_windows")
