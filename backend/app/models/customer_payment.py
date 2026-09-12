"""Customer cash receipts and their immutable invoice allocations."""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class CustomerPayment(Base):
    """One customer receipt, which may be split over several invoices.

    A receipt is never edited or deleted.  Operational corrections void it and
    leave the original receipt and allocation trail available for audit.
    """

    __tablename__ = "customer_payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_customer_payment_amount_positive"),
        CheckConstraint(
            "status IN ('received', 'voided')", name="ck_customer_payment_status"
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id = Column(
        Integer,
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    received_at = Column(DateTime(timezone=True), nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    payment_method = Column(String(30), nullable=True)
    reference = Column(String(160), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="received", index=True)
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    voided_at = Column(DateTime(timezone=True), nullable=True)
    voided_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    void_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    allocations = relationship(
        "CustomerPaymentAllocation",
        back_populates="payment",
        cascade="all, delete-orphan",
        order_by="CustomerPaymentAllocation.id",
    )
    client = relationship("Client")


class CustomerPaymentAllocation(Base):
    """Part of a receipt applied to exactly one definitive customer invoice."""

    __tablename__ = "customer_payment_allocations"
    __table_args__ = (
        CheckConstraint(
            "amount > 0", name="ck_customer_payment_allocation_amount_positive"
        ),
        UniqueConstraint(
            "payment_id",
            "invoice_id",
            name="uq_customer_payment_allocation_payment_invoice",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    payment_id = Column(
        Integer,
        ForeignKey("customer_payments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invoice_id = Column(
        Integer,
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount = Column(Numeric(14, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    payment = relationship("CustomerPayment", back_populates="allocations")
    invoice = relationship("Invoice")
