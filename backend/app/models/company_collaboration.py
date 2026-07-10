from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class CompanyCollaboration(Base):
    __tablename__ = "company_collaborations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    initiator_company_id = Column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    partner_company_id = Column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status = Column(String(20), nullable=False, default="pending", index=True)  # pending, accepted, rejected
    role_type = Column(String(30), nullable=False, default="service_provider")  # role of the partner
    token = Column(String(100), nullable=True, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    initiator = relationship("Company", foreign_keys=[initiator_company_id])
    partner = relationship("Company", foreign_keys=[partner_company_id])

    __table_args__ = (
        UniqueConstraint(
            "initiator_company_id", "partner_company_id", name="uq_company_collaboration"
        ),
    )
