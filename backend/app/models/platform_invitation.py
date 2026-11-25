from sqlalchemy import Column, ForeignKey, Integer, String

from app.db.session import Base


class PlatformInvitation(Base):
    __tablename__ = "platform_invitations"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), nullable=False, unique=True)
    issuer = Column(String(512), nullable=False)
    token_digest = Column(String(64), unique=True)
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("users.id"), unique=True)
    expires_at = Column(Integer, nullable=False)
    revoked_by = Column(Integer, ForeignKey("users.id"))
