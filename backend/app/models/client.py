from sqlalchemy.orm import relationship
from app.db.session import Base
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    func,
)


class Client(Base):
    __tablename__ = "clients"
    __table_args__ = (
        CheckConstraint(
            "relationship_status IN ('lead', 'client')",
            name="ck_client_relationship_status",
        ),
        UniqueConstraint(
            "company_id",
            "legal_number",
            name="uq_client_company_legal_number",
        ),
        UniqueConstraint("id", "company_id", name="uq_client_id_company"),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, index=True)
    client_type = Column(String(20), nullable=False, default="individual", index=True)
    relationship_status = Column(
        String(20), nullable=False, default="client", index=True
    )
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

    contacts = relationship(
        "ClientContact",
        back_populates="client",
        cascade="all, delete-orphan",
    )
    opportunities = relationship(
        "ClientOpportunity",
        back_populates="client",
        cascade="all, delete-orphan",
    )
    account_assignments = relationship(
        "ClientAccountAssignment",
        back_populates="client",
        cascade="all, delete-orphan",
        order_by="ClientAccountAssignment.id.desc()",
    )

    locations = relationship("Location", back_populates="client")

    invoices = relationship("Invoice", back_populates="client")
    quotes = relationship("Quote", back_populates="client")
    service_contracts = relationship("ServiceContract", back_populates="client")
    expenses = relationship("Expense", back_populates="client")
    portal_grants = relationship(
        "ClientPortalGrant",
        back_populates="client",
        cascade="all, delete-orphan",
        overlaps="company,client_portal_grants",
    )
    portal_invitations = relationship(
        "ClientPortalInvitation",
        back_populates="client",
        cascade="all, delete-orphan",
        overlaps="company,client_portal_invitations",
    )

    @property
    def current_account_assignment(self):
        return next(
            (
                assignment
                for assignment in self.account_assignments
                if assignment.ended_at is None
            ),
            None,
        )
