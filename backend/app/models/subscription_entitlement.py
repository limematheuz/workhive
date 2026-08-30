"""Versioned commercial plans and the effective access exceptions they allow."""

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    __table_args__ = (
        UniqueConstraint("code", "version", name="uq_subscription_plan_code_version"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    billing_provider = Column(String(50), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    entitlements = relationship(
        "PlanEntitlement", back_populates="plan", cascade="all, delete-orphan"
    )
    subscriptions = relationship("CompanySubscription", back_populates="plan")


class PlanEntitlement(Base):
    __tablename__ = "plan_entitlements"
    __table_args__ = (
        CheckConstraint(
            "value_type IN ('boolean', 'integer')",
            name="ck_plan_entitlement_value_type",
        ),
        CheckConstraint(
            "(value_type = 'boolean' AND boolean_value IS NOT NULL AND integer_value IS NULL) OR (value_type = 'integer' AND boolean_value IS NULL AND integer_value IS NOT NULL)",
            name="ck_plan_entitlement_value",
        ),
        CheckConstraint(
            "integer_value IS NULL OR integer_value >= 0",
            name="ck_plan_entitlement_non_negative_integer",
        ),
        UniqueConstraint("plan_id", "code", name="uq_plan_entitlement_plan_code"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_id = Column(
        Integer,
        ForeignKey("subscription_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code = Column(String(120), nullable=False, index=True)
    value_type = Column(String(20), nullable=False)
    boolean_value = Column(Boolean, nullable=True)
    integer_value = Column(Integer, nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    plan = relationship("SubscriptionPlan", back_populates="entitlements")


class PlanCatalogAudit(Base):
    """Immutable record of a published standard-plan version."""

    __tablename__ = "plan_catalog_audits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_id = Column(
        Integer,
        ForeignKey("subscription_plans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    plan_code = Column(String(50), nullable=False, index=True)
    plan_version = Column(Integer, nullable=False)
    actor_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reason = Column(Text, nullable=False)
    previous_value = Column(JSON, nullable=True)
    next_value = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class CompanySubscription(Base):
    __tablename__ = "company_subscriptions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('trialing', 'active', 'pending', 'past_due', 'unpaid', 'paused', 'canceled', 'expired', 'inactive', 'incomplete', 'incomplete_expired')",
            name="ck_company_subscription_status",
        ),
        CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at",
            name="ck_company_subscription_dates",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_id = Column(
        Integer,
        ForeignKey("subscription_plans.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status = Column(String(30), nullable=False, index=True)
    started_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    ended_at = Column(DateTime(timezone=True), nullable=True)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    billing_provider = Column(String(50), nullable=True)
    billing_customer_id = Column(String(100), nullable=True, index=True)
    billing_subscription_id = Column(String(100), nullable=True, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    company = relationship("Company", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")


class CompanyEntitlementOverride(Base):
    __tablename__ = "company_entitlement_overrides"
    __table_args__ = (
        CheckConstraint(
            "value_type IN ('boolean', 'integer')",
            name="ck_company_entitlement_override_value_type",
        ),
        CheckConstraint(
            "(value_type = 'boolean' AND boolean_value IS NOT NULL AND integer_value IS NULL) OR (value_type = 'integer' AND boolean_value IS NULL AND integer_value IS NOT NULL)",
            name="ck_company_entitlement_override_value",
        ),
        CheckConstraint(
            "integer_value IS NULL OR integer_value >= 0",
            name="ck_company_entitlement_override_non_negative_integer",
        ),
        CheckConstraint(
            "ends_at IS NULL OR ends_at >= starts_at",
            name="ck_company_entitlement_override_dates",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code = Column(String(120), nullable=False, index=True)
    value_type = Column(String(20), nullable=False)
    boolean_value = Column(Boolean, nullable=True)
    integer_value = Column(Integer, nullable=True)
    reason = Column(Text, nullable=False)
    starts_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    ends_at = Column(DateTime(timezone=True), nullable=True, index=True)
    configured_by_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    company = relationship("Company", back_populates="entitlement_overrides")


class EntitlementChangeAudit(Base):
    __tablename__ = "entitlement_change_audits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_subscription_id = Column(
        Integer,
        ForeignKey("company_subscriptions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    company_entitlement_override_id = Column(
        Integer,
        ForeignKey("company_entitlement_overrides.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    request_id = Column(String(64), nullable=True, index=True)
    action = Column(String(80), nullable=False, index=True)
    reason = Column(Text, nullable=True)
    previous_value = Column(JSON, nullable=True)
    next_value = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
