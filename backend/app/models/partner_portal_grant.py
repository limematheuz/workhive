"""Revocable portal access for a property-management partner.

This is deliberately separate from ``ExternalAccessGrant``. Accountants enter
one company's finance area; a property manager remains the legal owner of its
own locations and reservations while receiving a narrowly sponsored operational
portal from a collaborating service provider.
"""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class PartnerPortalGrant(Base):
    __tablename__ = "partner_portal_grants"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'revoked')",
            name="ck_partner_portal_grant_status",
        ),
        CheckConstraint(
            "revoked_at IS NULL OR revoked_at >= created_at",
            name="ck_partner_portal_grant_revocation_date",
        ),
        UniqueConstraint(
            "collaboration_id",
            "user_id",
            name="uq_partner_portal_grant_collaboration_user",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    host_company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    partner_company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    collaboration_id = Column(
        Integer,
        ForeignKey("company_collaborations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String(20), nullable=False, default="active", index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    granted_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    revoked_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    host_company = relationship(
        "Company",
        back_populates="sponsored_partner_portal_grants",
        foreign_keys=[host_company_id],
    )
    partner_company = relationship(
        "Company",
        back_populates="partner_portal_grants",
        foreign_keys=[partner_company_id],
    )
    collaboration = relationship("CompanyCollaboration")
    user = relationship(
        "User",
        back_populates="partner_portal_grants",
        foreign_keys=[user_id],
    )
    granted_by = relationship("User", foreign_keys=[granted_by_user_id])
    revoked_by = relationship("User", foreign_keys=[revoked_by_user_id])
