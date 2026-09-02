"""Commercial opportunities that belong to one client account.

This module deliberately contains no price, invoice or payment information.  It
only records the relationship work that happens before and around a service
agreement.
"""

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


OPPORTUNITY_STAGES = (
    "new",
    "qualified",
    "proposal",
    "negotiation",
    "won",
    "lost",
)

ACTIVITY_TYPES = ("note", "call", "email", "meeting", "stage_change")


class ClientOpportunity(Base):
    """One commercial process for a client, scoped through its client account."""

    __tablename__ = "client_opportunities"
    __table_args__ = (
        CheckConstraint(
            "stage IN ('new', 'qualified', 'proposal', 'negotiation', 'won', 'lost')",
            name="ck_client_opportunity_stage",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(
        Integer,
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contact_id = Column(
        Integer,
        ForeignKey("client_contacts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    owner_membership_id = Column(
        Integer,
        ForeignKey("company_memberships.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title = Column(String(160), nullable=False)
    stage = Column(String(20), nullable=False, default="new", index=True)
    next_follow_up_at = Column(DateTime(timezone=True), nullable=True, index=True)
    loss_reason = Column(String(500), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    client = relationship("Client", back_populates="opportunities")
    contact = relationship("ClientContact")
    owner_membership = relationship("CompanyMembership")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    activities = relationship(
        "ClientOpportunityActivity",
        back_populates="opportunity",
        cascade="all, delete-orphan",
    )

    @property
    def owner_name(self) -> str | None:
        user = self.owner_membership.user if self.owner_membership else None
        return user.full_name if user else None


class ClientOpportunityActivity(Base):
    """An immutable manual activity or automatic stage transition."""

    __tablename__ = "client_opportunity_activities"
    __table_args__ = (
        CheckConstraint(
            "activity_type IN ('note', 'call', 'email', 'meeting', 'stage_change')",
            name="ck_client_opportunity_activity_type",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    opportunity_id = Column(
        Integer,
        ForeignKey("client_opportunities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    activity_type = Column(String(20), nullable=False, index=True)
    body = Column(Text, nullable=True)
    stage_from = Column(String(20), nullable=True)
    stage_to = Column(String(20), nullable=True)
    happened_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    opportunity = relationship("ClientOpportunity", back_populates="activities")
    created_by = relationship("User", foreign_keys=[created_by_user_id])

    @property
    def actor_name(self) -> str | None:
        return self.created_by.full_name if self.created_by else None
