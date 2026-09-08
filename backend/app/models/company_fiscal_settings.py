from sqlalchemy import (
    Boolean,
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


class CompanyFiscalSettings(Base):
    __tablename__ = "company_fiscal_settings"

    id = Column(Integer, primary_key=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    enabled = Column(Boolean, nullable=False, default=False)
    environment = Column(String(20), nullable=False, default="test")
    quarterly_vat_enabled = Column(Boolean, nullable=False, default=False)
    quarterly_withholding_enabled = Column(Boolean, nullable=False, default=False)
    fiscal_reminder_days = Column(Integer, nullable=False, default=7)
    # certificate_path is retained only for a controlled legacy read fallback.
    certificate_path = Column(Text, nullable=True)
    certificate_storage_key = Column(String(500), nullable=True)
    certificate_sha256 = Column(String(64), nullable=True)
    certificate_content_type = Column(String(120), nullable=True)
    certificate_size_bytes = Column(Integer, nullable=True)
    certificate_password_encrypted = Column(Text, nullable=True)
    certificate_uploaded_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    company = relationship("Company")
