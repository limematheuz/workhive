from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class UserInvitation(Base):
    __tablename__ = "user_invitations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
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
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    full_name = Column(String(100), nullable=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    code_hash = Column(String(64), nullable=False)
    status = Column(String(30), nullable=False, default="pending", index=True)
    failed_attempts = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    company = relationship("Company")
