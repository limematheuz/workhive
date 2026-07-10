from sqlalchemy import (
    JSON,
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


class FiscalInvoiceRecord(Base):
    __tablename__ = "fiscal_invoice_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(
        Integer, ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    company_id = Column(
        Integer, ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    record_type = Column(String(20), nullable=False)
    payload = Column(JSON, nullable=False)
    previous_hash = Column(String(64), nullable=True)
    record_hash = Column(String(64), nullable=False, unique=True, index=True)
    hash_algorithm = Column(String(20), nullable=False, default="SHA-256")
    submission_status = Column(
        String(30), nullable=False, default="not_configured", index=True
    )
    aeat_csv = Column(String(255), nullable=True)
    aeat_response = Column(JSON, nullable=True)
    request_xml = Column(Text, nullable=True)
    response_xml = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    operation_reason = Column(Text, nullable=True)
    attempt_count = Column(Integer, nullable=False, default=0)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)
    generated_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    invoice = relationship("Invoice", back_populates="fiscal_records")
