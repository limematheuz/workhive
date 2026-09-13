"""Immutable bank-statement evidence and its receipt reconciliation trail."""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class BankStatementEntry(Base):
    """One imported bank credit. Its amount and source details never change."""

    __tablename__ = "bank_statement_entries"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_bank_statement_entry_amount_positive"),
        CheckConstraint(
            "status IN ('unmatched', 'matched')",
            name="ck_bank_statement_entry_status",
        ),
        UniqueConstraint(
            "company_id",
            "external_id",
            name="uq_bank_statement_entry_company_external_id",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    booked_at = Column(DateTime(timezone=True), nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="EUR")
    account_label = Column(String(100), nullable=True)
    external_id = Column(String(160), nullable=True)
    reference = Column(String(160), nullable=True, index=True)
    counterparty = Column(String(160), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="unmatched", index=True)
    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    reconciliations = relationship(
        "BankReconciliation",
        back_populates="entry",
        order_by="BankReconciliation.id.desc()",
    )


class BankReconciliation(Base):
    """Auditable match between a bank entry and one customer receipt."""

    __tablename__ = "bank_reconciliations"
    __table_args__ = (
        CheckConstraint(
            "status IN ('matched', 'reversed')",
            name="ck_bank_reconciliation_status",
        ),
        Index(
            "ix_bank_reconciliation_entry_status",
            "bank_statement_entry_id",
            "status",
        ),
        Index(
            "ix_bank_reconciliation_payment_status",
            "customer_payment_id",
            "status",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    bank_statement_entry_id = Column(
        Integer,
        ForeignKey("bank_statement_entries.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    customer_payment_id = Column(
        Integer,
        ForeignKey("customer_payments.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status = Column(String(20), nullable=False, default="matched", index=True)
    matched_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    matched_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reversed_at = Column(DateTime(timezone=True), nullable=True)
    reversed_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reversal_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    entry = relationship("BankStatementEntry", back_populates="reconciliations")
    payment = relationship("CustomerPayment")
