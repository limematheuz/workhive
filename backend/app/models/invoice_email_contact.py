from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class InvoiceEmailContact(Base):
    __tablename__ = "invoice_email_contacts"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "email",
            name="uq_invoice_email_contact_company_email",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    name = Column(String(120), nullable=True)
    email = Column(String(254), nullable=False, index=True)
    source = Column(String(40), nullable=False, default="invoice_email")
    use_count = Column(Integer, nullable=False, default=0)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    company = relationship("Company")
