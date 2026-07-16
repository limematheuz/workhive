from sqlalchemy.orm import relationship
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, func
from app.db.session import Base


class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, index=True)
    tax_id = Column(String(20), unique=True, nullable=False, index=True)
    address = Column(String(255), nullable=False)
    postal_code = Column(String(10), nullable=True)
    city = Column(String(100), nullable=True)
    province = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=False, index=True)
    email = Column(String(100), nullable=False, index=True)
    logo = Column(Text, nullable=True)
    bank_account = Column(String(50), nullable=True)
    default_payment_notes = Column(Text, nullable=True)
    default_document_terms = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    onboarding_completed = Column(Boolean, default=False, nullable=False)
    partner_code = Column(String(50), unique=True, nullable=True, index=True)
    subscription_plan = Column(String(30), nullable=False, default="none")
    subscription_status = Column(String(30), nullable=False, default="inactive", index=True)
    trial_started_at = Column(DateTime(timezone=True), nullable=True)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    stripe_customer_id = Column(String(100), unique=True, nullable=True, index=True)
    stripe_subscription_id = Column(String(100), unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    users = relationship("User", back_populates="company")
    clients = relationship("Client", back_populates="company")

    invoices = relationship("Invoice", back_populates="company")
    quotes = relationship("Quote", back_populates="company")
    expenses = relationship("Expense", back_populates="company")
    location_access = relationship(
        "LocationCompanyAccess", back_populates="company", cascade="all, delete-orphan"
    )
    managed_locations = relationship(
        "Location",
        back_populates="managing_company",
        foreign_keys="Location.managing_company_id",
    )
    owned_locations = relationship(
        "Location",
        back_populates="owner_company",
        foreign_keys="Location.owner_company_id",
    )
    owned_reservations = relationship(
        "Reservation",
        back_populates="owner_company",
        foreign_keys="Reservation.owner_company_id",
    )
    template_tasks = relationship(
        "TemplateTask", back_populates="company", cascade="all, delete-orphan"
    )

    @property
    def contact_email(self) -> str | None:
        """Primary operational contact for collaboration-facing views.

        Company.email remains the fiscal/business email. Operational views only
        expose an active company member and never fall back to platform data.
        """
        active_users = sorted(
            (user for user in self.users if user.is_active and user.email),
            key=lambda user: user.id or 0,
        )
        users_by_role: dict[str, list] = {}
        for user in active_users:
            role_name = user.role.name if user.role else ""
            if role_name == "superadmin":
                continue
            users_by_role.setdefault(role_name, []).append(user)

        for role_name in ("admin", "manager", "viewer"):
            users = users_by_role.get(role_name)
            if users:
                return users[0].email

        return None
