from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func

from app.db.session import Base


class PrivacyConsent(Base):
    __tablename__ = "privacy_consents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    consent_type = Column(String(50), nullable=False, index=True)
    policy_version = Column(String(30), nullable=False)
    accepted = Column(Boolean, nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    withdrawn_at = Column(DateTime(timezone=True), nullable=True)
