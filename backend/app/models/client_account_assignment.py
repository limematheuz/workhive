"""Commercial portfolio assignments for client accounts."""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class ClientAccountAssignment(Base):
    """A historical commercial-owner assignment scoped to one company."""

    __tablename__ = "client_account_assignments"
    __table_args__ = (
        CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at",
            name="ck_client_account_assignment_dates",
        ),
        UniqueConstraint(
            "id",
            "company_id",
            name="uq_client_account_assignment_id_company",
        ),
        ForeignKeyConstraint(
            ["client_id", "company_id"],
            ["clients.id", "clients.company_id"],
            ondelete="CASCADE",
            name="fk_client_account_assignment_client_company",
        ),
        ForeignKeyConstraint(
            ["company_membership_id", "company_id"],
            ["company_memberships.id", "company_memberships.company_id"],
            ondelete="RESTRICT",
            name="fk_client_account_assignment_membership_company",
        ),
        Index(
            "uq_client_account_assignment_current_client",
            "client_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
            sqlite_where=text("ended_at IS NULL"),
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, nullable=False, index=True)
    client_id = Column(Integer, nullable=False, index=True)
    company_membership_id = Column(Integer, nullable=False, index=True)
    assigned_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    started_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    ended_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    client = relationship("Client", back_populates="account_assignments")
    company_membership = relationship(
        "CompanyMembership",
        back_populates="client_account_assignments",
        overlaps="account_assignments,client",
    )
    assigned_by = relationship("User", foreign_keys=[assigned_by_user_id])

    @property
    def owner_name(self) -> str | None:
        user = self.company_membership.user if self.company_membership else None
        return user.full_name if user else None

    @property
    def owner_email(self) -> str | None:
        user = self.company_membership.user if self.company_membership else None
        return user.email if user else None
