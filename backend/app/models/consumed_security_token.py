from sqlalchemy import Column, DateTime, String
from sqlalchemy.sql import func

from app.db.session import Base


class ConsumedSecurityToken(Base):
    __tablename__ = "consumed_security_tokens"

    jti = Column(String(64), primary_key=True)
    purpose = Column(String(64), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
