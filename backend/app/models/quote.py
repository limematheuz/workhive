from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    UniqueConstraint,
    Text,
    func,
)
from sqlalchemy.orm import relationship
from app.db.session import Base


class Quote(Base):
    __tablename__ = "quotes"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "quote_number", name="uq_company_quote_number"
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    quote_number = Column(String(50), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    status = Column(String(20), default="draft", nullable=False)  
    valid_until = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    tax_rate = Column(Float, default=0.21, nullable=False)  
    base_amount = Column(Float, default=0.0, nullable=False)
    tax_amount = Column(Float, default=0.0, nullable=False)
    total_amount = Column(Float, default=0.0, nullable=False)
    is_active = Column(Boolean, default=True)

    # Custom quote layout fields to match invoices
    discount = Column(Float, default=0.0, nullable=False)
    equivalence_surcharge = Column(Float, default=0.0, nullable=False)
    retention = Column(Float, default=0.0, nullable=False)
    terms = Column(String(1000), nullable=True)
    shipping_address = Column(String(500), nullable=True)
    custom_issuer_info = Column(String(1000), nullable=True)
    custom_recipient_info = Column(String(1000), nullable=True)
    signature_url = Column(Text, nullable=True)
    revision_number = Column(Integer, default=1, nullable=False)
    accepted_revision_id = Column(
        Integer,
        ForeignKey(
            "quote_revisions.id",
            name="fk_quotes_accepted_revision",
            ondelete="SET NULL",
            use_alter=True,
        ),
        nullable=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    company = relationship("Company", back_populates="quotes")

    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    client = relationship("Client", back_populates="quotes")

    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")
    revisions = relationship(
        "QuoteRevision",
        back_populates="quote",
        cascade="all, delete-orphan",
        foreign_keys="QuoteRevision.quote_id",
    )
    accepted_revision = relationship(
        "QuoteRevision",
        foreign_keys=[accepted_revision_id],
        post_update=True,
    )
    service_contract = relationship(
        "ServiceContract",
        back_populates="source_quote",
        uselist=False,
    )
