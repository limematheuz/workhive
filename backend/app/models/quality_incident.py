from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class QualityIncident(Base):
    """A quality deviation, optionally linked to one frozen inspection point."""

    __tablename__ = "quality_incidents"
    __table_args__ = (
        CheckConstraint("severity IN ('low', 'medium', 'high', 'critical')", name="ck_quality_incident_severity"),
        CheckConstraint("status IN ('open', 'in_progress', 'resolved', 'closed')", name="ck_quality_incident_status"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    inspection_id = Column(Integer, ForeignKey("quality_inspections.id", ondelete="SET NULL"), nullable=True, index=True)
    inspection_item_id = Column(Integer, ForeignKey("quality_inspection_items.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), nullable=False, default="medium", server_default="medium", index=True)
    status = Column(String(20), nullable=False, default="open", server_default="open", index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    company = relationship("Company")
    location = relationship("Location")
    inspection = relationship("QualityInspection")
    inspection_item = relationship("QualityInspectionItem")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_user_id])
    corrective_actions = relationship(
        "QualityCorrectiveAction",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="QualityCorrectiveAction.id",
    )
    evidence = relationship(
        "QualityEvidence",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="QualityEvidence.created_at",
    )


class QualityCorrectiveAction(Base):
    __tablename__ = "quality_corrective_actions"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'completed', 'cancelled')", name="ck_quality_corrective_action_status"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(Integer, ForeignKey("quality_incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending", server_default="pending", index=True)
    due_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    completed_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    incident = relationship("QualityIncident", back_populates="corrective_actions")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    completed_by = relationship("User", foreign_keys=[completed_by_user_id])
