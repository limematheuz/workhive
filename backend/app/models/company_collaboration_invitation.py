from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class CompanyCollaborationInvitation(Base):
    __tablename__ = "company_collaboration_invitations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    inviter_company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invited_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    accepted_company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    email = Column(String(255), nullable=False, index=True)
    role_type = Column(String(30), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    verification_code_hash = Column(String(64), nullable=True, unique=True, index=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    inviter_company = relationship("Company", foreign_keys=[inviter_company_id])
    accepted_company = relationship("Company", foreign_keys=[accepted_company_id])
    invited_by = relationship("User", foreign_keys=[invited_by_user_id])
