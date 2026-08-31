"""A paid-company checkout that exists before a WorkHive tenant does."""

from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)

from app.db.session import Base


class CompanyPurchaseIntent(Base):
    """Immutable commercial input, activated only after Stripe confirms payment."""

    __tablename__ = "company_purchase_intents"
    __table_args__ = (
        CheckConstraint(
            "status IN ('checkout_created', 'checkout_completed', 'paid', 'activated', 'expired', 'canceled')",
            name="ck_company_purchase_intent_status",
        ),
        CheckConstraint(
            "billing_interval IN ('monthly', 'annual')",
            name="ck_company_purchase_intent_billing_interval",
        ),
        UniqueConstraint(
            "stripe_checkout_session_id",
            name="uq_company_purchase_intent_checkout_session",
        ),
        UniqueConstraint(
            "stripe_subscription_id",
            name="uq_company_purchase_intent_subscription",
        ),
        UniqueConstraint(
            "activation_token_hash",
            name="uq_company_purchase_intent_activation_token",
        ),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    plan_id = Column(
        Integer,
        ForeignKey("subscription_plans.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    plan_code = Column(String(50), nullable=False, index=True)
    plan_version = Column(Integer, nullable=False)
    billing_interval = Column(String(20), nullable=False, default="monthly")

    company_name = Column(String(100), nullable=False)
    tax_id = Column(String(20), nullable=False, index=True)
    address = Column(String(255), nullable=False)
    postal_code = Column(String(10), nullable=True)
    city = Column(String(100), nullable=True)
    province = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=False)
    company_email = Column(String(100), nullable=False)
    owner_full_name = Column(String(100), nullable=False)
    owner_email = Column(String(255), nullable=False, index=True)
    marketing_consent = Column(Boolean, nullable=False, default=False)
    privacy_policy_version = Column(String(50), nullable=False)

    status = Column(String(30), nullable=False, default="checkout_created", index=True)
    stripe_checkout_session_id = Column(String(255), nullable=True)
    stripe_customer_id = Column(String(100), nullable=True, index=True)
    stripe_subscription_id = Column(String(100), nullable=True)
    activation_token_hash = Column(String(64), nullable=True)
    activation_expires_at = Column(DateTime(timezone=True), nullable=True)
    activation_email_sent_at = Column(DateTime(timezone=True), nullable=True)
    payment_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    activated_at = Column(DateTime(timezone=True), nullable=True)
    activated_company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    activated_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
