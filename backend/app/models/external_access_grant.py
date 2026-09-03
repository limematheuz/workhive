"""Company-scoped access granted to somebody outside the internal team."""

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


class ExternalAccessGrant(Base):
    """A revocable external portal relationship, never an internal membership.

    The current product policy implements the ``accountant`` access type. The
    explicit type leaves a durable boundary for future customer and partner
    portals without allowing either to inherit internal permission profiles.
    """

    __tablename__ = "external_access_grants"
    __table_args__ = (
        CheckConstraint(
            "access_type IN ('accountant', 'client', 'partner')",
            name="ck_external_access_grant_type",
        ),
        CheckConstraint(
            "status IN ('active', 'revoked')",
            name="ck_external_access_grant_status",
        ),
        CheckConstraint(
            "revoked_at IS NULL OR revoked_at >= created_at",
            name="ck_external_access_grant_revocation_date",
        ),
        UniqueConstraint(
            "company_id",
            "user_id",
            "access_type",
            name="uq_external_access_grant_company_user_type",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    access_type = Column(String(30), nullable=False, index=True)
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

    company = relationship("Company", back_populates="external_access_grants")
    user = relationship(
        "User",
        back_populates="external_access_grants",
        foreign_keys=[user_id],
    )
    granted_by = relationship("User", foreign_keys=[granted_by_user_id])
    revoked_by = relationship("User", foreign_keys=[revoked_by_user_id])
