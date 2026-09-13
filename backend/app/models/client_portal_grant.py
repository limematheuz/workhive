"""Revocable, document-only access for a company's customer.

Customer access is intentionally not an ``ExternalAccessGrant``: an accountant
can read a whole company's finance area, while a customer must stay bound to
one concrete client record.  A person may receive several grants and selects
one scoped workspace at a time.
"""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class ClientPortalGrant(Base):
    __tablename__ = "client_portal_grants"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'revoked')",
            name="ck_client_portal_grant_status",
        ),
        CheckConstraint(
            "revoked_at IS NULL OR revoked_at >= created_at",
            name="ck_client_portal_grant_revocation_date",
        ),
        ForeignKeyConstraint(
            ["client_id", "company_id"],
            ["clients.id", "clients.company_id"],
            name="fk_client_portal_grant_client_company",
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "company_id",
            "client_id",
            "user_id",
            name="uq_client_portal_grant_company_client_user",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id = Column(Integer, nullable=False, index=True)
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
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    company = relationship(
        "Company",
        back_populates="client_portal_grants",
        overlaps="client,portal_grants",
    )
    client = relationship(
        "Client",
        back_populates="portal_grants",
        foreign_keys=[client_id, company_id],
        overlaps="company,client_portal_grants",
    )
    user = relationship(
        "User",
        back_populates="client_portal_grants",
        foreign_keys=[user_id],
    )
    granted_by = relationship("User", foreign_keys=[granted_by_user_id])
    revoked_by = relationship("User", foreign_keys=[revoked_by_user_id])
