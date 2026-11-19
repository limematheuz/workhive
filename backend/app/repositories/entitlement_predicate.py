"""Effective boolean access as a scalar predicate for bounded resource queries."""

from datetime import datetime

from sqlalchemy import case, false, func, or_, select

from app.models.company import Company
from app.models.subscription_entitlement import (
    CompanyEntitlementOverride,
    CompanySubscription,
    PlanEntitlement,
)


def boolean_entitlement(
    company_id: int,
    code: str,
    now: datetime,
    legacy_values: dict[str, bool],
    default_value: bool,
):
    plan_id = (
        select(CompanySubscription.plan_id)
        .where(CompanySubscription.company_id == company_id)
        .order_by(
            CompanySubscription.ended_at.is_(None).desc(),
            CompanySubscription.started_at.desc(),
            CompanySubscription.id.desc(),
        )
        .limit(1)
        .scalar_subquery()
    )
    plan_value = (
        select(PlanEntitlement.boolean_value)
        .where(
            PlanEntitlement.plan_id == plan_id,
            PlanEntitlement.code == code,
            PlanEntitlement.value_type == "boolean",
        )
        .scalar_subquery()
    )
    override = (
        select(
            case(
                (
                    CompanyEntitlementOverride.value_type == "boolean",
                    CompanyEntitlementOverride.boolean_value,
                ),
                else_=false(),
            )
        )
        .where(
            CompanyEntitlementOverride.company_id == company_id,
            CompanyEntitlementOverride.code == code,
            CompanyEntitlementOverride.starts_at <= now,
            or_(
                CompanyEntitlementOverride.ends_at.is_(None),
                CompanyEntitlementOverride.ends_at > now,
            ),
        )
        .order_by(
            CompanyEntitlementOverride.starts_at.desc(),
            CompanyEntitlementOverride.id.desc(),
        )
        .limit(1)
        .scalar_subquery()
    )
    legacy = (
        select(
            case(
                legacy_values,
                value=func.lower(
                    func.trim(func.coalesce(Company.subscription_plan, "none"))
                ),
                else_=default_value,
            )
        )
        .where(Company.id == company_id)
        .scalar_subquery()
    )
    # A persisted plan with a missing feature fails closed; only legacy rows
    # without a subscription use catalogue defaults.
    base = case(
        (plan_id.is_not(None), func.coalesce(plan_value, false())), else_=legacy
    )
    return func.coalesce(override, base, false()).is_(True)
