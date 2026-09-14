from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class QualityComplaint(Base):
    """A customer complaint, deliberately separate from an internal incident."""

    __tablename__ = "quality_complaints"
    __table_args__ = (
        CheckConstraint(
            "category IN ('service', 'billing', 'damage', 'other')",
            name="ck_quality_complaint_category",
        ),
        CheckConstraint(
            "status IN ('submitted', 'in_review', 'resolved', 'closed')",
            name="ck_quality_complaint_status",
        ),
        CheckConstraint(
            "source IN ('client_portal', 'internal')",
            name="ck_quality_complaint_source",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    client_portal_grant_id = Column(
        Integer, ForeignKey("client_portal_grants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    submitted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(20), nullable=False, default="service", server_default="service", index=True)
    status = Column(String(20), nullable=False, default="submitted", server_default="submitted", index=True)
    source = Column(String(20), nullable=False, default="internal", server_default="internal", index=True)
    internal_notes = Column(Text, nullable=True)
    customer_response = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    company = relationship("Company")
    client = relationship("Client")
    location = relationship("Location")
    client_portal_grant = relationship("ClientPortalGrant")
    submitted_by = relationship("User", foreign_keys=[submitted_by_user_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_user_id])
