from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class LaborCostRate(Base):
    """Confidential internal hourly-cost history for one company membership.

    This deliberately records an operational cost rate, never salary, payroll,
    tax, or banking data.  A new effective date creates a new immutable rate so
    completed work sessions retain their original labour-cost snapshot.
    """

    __tablename__ = "labor_cost_rates"
    __table_args__ = (
        CheckConstraint("hourly_cost >= 0", name="ck_labor_cost_rates_non_negative"),
        UniqueConstraint(
            "company_membership_id",
            "effective_on",
            name="uq_labor_cost_rate_membership_effective_on",
        ),
        ForeignKeyConstraint(
            ["company_membership_id", "company_id"],
            ["company_memberships.id", "company_memberships.company_id"],
            ondelete="CASCADE",
            name="fk_labor_cost_rate_membership_company",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_membership_id = Column(Integer, nullable=False, index=True)
    hourly_cost = Column(Numeric(10, 2), nullable=False)
    effective_on = Column(Date, nullable=False, index=True)
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    company_membership = relationship(
        "CompanyMembership",
        back_populates="labor_cost_rates",
        viewonly=True,
    )
    created_by = relationship("User", foreign_keys=[created_by_user_id])

    @property
    def member_name(self) -> str | None:
        member = self.company_membership
        if not member or not member.user:
            return None
        return member.user.full_name or member.user.email
