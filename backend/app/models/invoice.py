from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    Numeric,
    UniqueConstraint,
    Text,
    func,
)
from sqlalchemy.orm import relationship
from app.db.session import Base


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "invoice_number", name="uq_company_invoice_number"
        ),
    )

    id = Column(Integer, primary_key=True)
    invoice_number = Column(String(50), index=True, nullable=False)
    issue_date = Column(DateTime(timezone=True), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="draft", nullable=False)
    base_amount = Column(Numeric(14, 2), default=0, nullable=False)
    tax_amount = Column(Numeric(14, 2), default=0, nullable=False)
    total_amount = Column(Numeric(14, 2), default=0, nullable=False)
    invoice_hash = Column(String(255), nullable=True)
    previous_invoice_hash = Column(String(255), nullable=True)
    is_rectification = Column(Boolean, default=False)
    original_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    original_invoice = relationship(
        "Invoice",
        remote_side=[id],
        foreign_keys=[original_invoice_id],
    )
    is_active = Column(Boolean, default=True)

    discount = Column(Numeric(7, 4), default=0, nullable=False)
    equivalence_surcharge = Column(Numeric(7, 4), default=0, nullable=False)
    retention = Column(Numeric(7, 4), default=0, nullable=False)
    payment_method = Column(String(30), nullable=True)
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)
    shipping_address = Column(Text, nullable=True)
    custom_issuer_info = Column(Text, nullable=True)
    custom_recipient_info = Column(Text, nullable=True)
    signature_url = Column(Text, nullable=True)
    issued_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    issuer_snapshot = Column(JSON, nullable=True)
    recipient_snapshot = Column(JSON, nullable=True)
    rectification_reason = Column(Text, nullable=True)
    rectification_reason_code = Column(String(2), nullable=True)
    fiscal_submission_status = Column(
        String(30), nullable=False, default="not_configured"
    )
    qr_url = Column(Text, nullable=True)
    aeat_csv = Column(String(255), nullable=True)
    pdf_path = Column(Text, nullable=True)
    pdf_sha256 = Column(String(64), nullable=True)
    pdf_generated_at = Column(DateTime(timezone=True), nullable=True)
    facturae_path = Column(Text, nullable=True)
    facturae_sha256 = Column(String(64), nullable=True)
    facturae_generated_at = Column(DateTime(timezone=True), nullable=True)
    facturae_signed_at = Column(DateTime(timezone=True), nullable=True)
    facturae_signature_status = Column(
        String(20), nullable=False, default="not_generated"
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="invoices")

    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    client = relationship("Client", back_populates="invoices")

    items = relationship(
        "InvoiceItem", back_populates="invoice", cascade="all, delete-orphan"
    )
    fiscal_records = relationship(
        "FiscalInvoiceRecord",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="FiscalInvoiceRecord.id",
    )
