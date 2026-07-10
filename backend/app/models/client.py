from sqlalchemy.orm import relationship
from app.db.session import Base
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    func,
)


class Client(Base):
    __tablename__ = "clients"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "legal_number",
            name="uq_client_company_legal_number",
        ),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, index=True)
    client_type = Column(String(20), nullable=False, default="individual", index=True)
    legal_number = Column(String(20), nullable=True, index=True)
    address = Column(String(255), nullable=False)
    city = Column(String(100), nullable=False)
    province = Column(String(100), nullable=True)
    postal_code = Column(String(10), nullable=False)
    country = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="clients")

    locations = relationship("Location", back_populates="client")

    invoices = relationship("Invoice", back_populates="client")
    quotes = relationship("Quote", back_populates="client")
