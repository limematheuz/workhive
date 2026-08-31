"""Published price lookup shared by public catalogue and Stripe checkout."""

from fastapi import HTTPException, status

from app.models.subscription_entitlement import PlanPrice, SubscriptionPlan


BILLING_INTERVALS = ("monthly", "annual")

# Amounts are cents, tax-exclusive and billed per company. The yearly rate is
# intentionally the displayed monthly equivalent multiplied by twelve.
DEFAULT_PLAN_PRICE_VALUES = {
    "basic": {"monthly": 2900, "annual": 28800},
    "medium": {"monthly": 6900, "annual": 70800},
    "top": {"monthly": 12900, "annual": 130800},
    "mega": {"monthly": 24900, "annual": 250800},
}


def price_for_interval(
    plan: SubscriptionPlan, billing_interval: str
) -> PlanPrice | None:
    return next(
        (
            price
            for price in plan.prices
            if price.billing_interval == billing_interval
        ),
        None,
    )


def require_price_for_interval(
    plan: SubscriptionPlan, billing_interval: str
) -> PlanPrice:
    price = price_for_interval(plan, billing_interval)
    if price is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The selected billing interval is not available for this plan",
        )
    return price
