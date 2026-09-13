from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class QualityEvidence(Base):
    """An image captured as evidence for one quality inspection or incident."""

    __tablename__ = "quality_evidence"
    __table_args__ = (
        CheckConstraint(
            "(inspection_id IS NOT NULL AND incident_id IS NULL) OR "
            "(inspection_id IS NULL AND incident_id IS NOT NULL)",
            name="ck_quality_evidence_one_subject",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    inspection_id = Column(Integer, ForeignKey("quality_inspections.id", ondelete="CASCADE"), nullable=True, index=True)
    incident_id = Column(Integer, ForeignKey("quality_incidents.id", ondelete="CASCADE"), nullable=True, index=True)
    media_key = Column(String(500), nullable=False, unique=True)
    file_name = Column(String(255), nullable=True)
    caption = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    company = relationship("Company")
    location = relationship("Location")
    inspection = relationship("QualityInspection", back_populates="evidence")
    incident = relationship("QualityIncident", back_populates="evidence")
    created_by = relationship("User", foreign_keys=[created_by_user_id])

    @property
    def media_url(self) -> str:
        if self.inspection_id is not None:
            return f"/api/v1/quality/inspections/{self.inspection_id}/evidence/{self.id}/media"
        return f"/api/v1/quality/incidents/{self.incident_id}/evidence/{self.id}/media"
