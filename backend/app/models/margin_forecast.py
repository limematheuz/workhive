"""Explicit direct-cost budgets for contract and work-order margin views."""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    func,
)

from app.db.session import Base


class MarginForecast(Base):
    """One current, explicit cost baseline per operational commercial scope.

    The forecast intentionally contains no apportioned overhead.  Its target is
    either a whole service contract or one work order; actuals are calculated
    only from records that carry the same operational trace.
    """

    __tablename__ = "margin_forecasts"
    __table_args__ = (
        CheckConstraint(
            "(service_contract_id IS NOT NULL AND work_order_id IS NULL) "
            "OR (service_contract_id IS NULL AND work_order_id IS NOT NULL)",
            name="ck_margin_forecast_one_scope",
        ),
        CheckConstraint(
            "planned_direct_cost_amount >= 0",
            name="ck_margin_forecast_cost_nonnegative",
        ),
        UniqueConstraint(
            "service_contract_id", name="uq_margin_forecast_service_contract_id"
        ),
        UniqueConstraint("work_order_id", name="uq_margin_forecast_work_order_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    service_contract_id = Column(
        Integer,
        ForeignKey("service_contracts.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    work_order_id = Column(
        Integer,
        ForeignKey("work_orders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    planned_direct_cost_amount = Column(Numeric(14, 2), nullable=False)
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
