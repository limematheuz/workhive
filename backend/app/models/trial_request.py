from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class TrialRequest(Base):
    __tablename__ = "trial_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    company_name = Column(String(120), nullable=False)
    phone = Column(String(30), nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String(40), nullable=False, default="pending_email_verification", index=True)
    verification_token_hash = Column(String(64), nullable=False, unique=True, index=True)
    verification_token_expires_at = Column(DateTime(timezone=True), nullable=False)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    requested_trial_days = Column(Integer, nullable=True)
    approved_trial_days = Column(Integer, nullable=True)
    approval_mode = Column(String(20), nullable=True)
    decision_note = Column(Text, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    created_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    approved_by = relationship("User", foreign_keys=[approved_by_user_id])
    created_company = relationship("Company", foreign_keys=[created_company_id])
    created_user = relationship("User", foreign_keys=[created_user_id])
