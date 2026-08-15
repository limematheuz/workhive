from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class SalesLedgerRecord(Base):
    """A manually maintained historical sale, kept separate from fiscal invoices."""

    __tablename__ = "sales_ledger_records"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "document_number",
            name="uq_sales_ledger_record_company_document",
        ),
        CheckConstraint("base_amount >= 0", name="ck_sales_ledger_record_base_amount"),
        CheckConstraint("tax_amount >= 0", name="ck_sales_ledger_record_tax_amount"),
        CheckConstraint("total_amount >= 0", name="ck_sales_ledger_record_total_amount"),
        CheckConstraint(
            "payment_status IN ('paid', 'pending')",
            name="ck_sales_ledger_record_payment_status",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    document_number = Column(String(50), nullable=False)
    entry_date = Column(Date, nullable=False, index=True)
    client_name = Column(String(160), nullable=False, index=True)
    base_amount = Column(Numeric(14, 2), nullable=False)
    tax_amount = Column(Numeric(14, 2), nullable=False)
    total_amount = Column(Numeric(14, 2), nullable=False)
    payment_status = Column(String(20), nullable=False, default="pending")
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    company = relationship("Company", back_populates="sales_ledger_records")
    created_by = relationship("User")
