"""Operational planning records kept separate from executable task instances."""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class WorkOrder(Base):
    __tablename__ = "work_orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'active', 'paused', 'completed', 'cancelled')",
            name="ck_work_order_status",
        ),
        CheckConstraint(
            "order_type IN ('one_off', 'recurring')",
            name="ck_work_order_type",
        ),
        CheckConstraint(
            "recurrence_unit IS NULL OR recurrence_unit IN ('weekly', 'monthly')",
            name="ck_work_order_recurrence_unit",
        ),
        CheckConstraint(
            "recurrence_interval IS NULL OR recurrence_interval > 0",
            name="ck_work_order_recurrence_interval",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="draft", index=True)
    order_type = Column(String(20), nullable=False, default="one_off", index=True)
    scheduled_start_at = Column(DateTime(timezone=True), nullable=False, index=True)
    next_occurrence_at = Column(DateTime(timezone=True), nullable=True, index=True)
    recurrence_unit = Column(String(20), nullable=True)
    recurrence_interval = Column(Integer, nullable=True)
    recurrence_ends_at = Column(DateTime(timezone=True), nullable=True)
    estimated_people = Column(Integer, nullable=True)
    estimated_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id = Column(
        Integer,
        ForeignKey("locations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    service_contract_id = Column(
        Integer,
        ForeignKey("service_contracts.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    company = relationship("Company")
    location = relationship("Location")
    service_contract = relationship("ServiceContract")
    created_by = relationship("User")
    task_items = relationship("TaskItem", back_populates="work_order")
