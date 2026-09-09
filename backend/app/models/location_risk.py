from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class LocationRisk(Base):
    """An active or mitigated operational risk tied to one location."""

    __tablename__ = "location_risks"
    __table_args__ = (
        CheckConstraint(
            "severity IN ('low', 'medium', 'high', 'critical')",
            name="ck_location_risk_severity",
        ),
        CheckConstraint(
            "status IN ('open', 'mitigated')",
            name="ck_location_risk_status",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(
        Integer,
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), nullable=False, default="medium", index=True)
    status = Column(String(20), nullable=False, default="open", index=True)
    mitigation_notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    location = relationship("Location", back_populates="risks")
