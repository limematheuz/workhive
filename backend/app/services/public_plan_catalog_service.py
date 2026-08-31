"""Read the current standard plans for the public purchase journey."""

from sqlalchemy.orm import Session

from app.core.config import settings
from app.repositories import subscription_entitlement as entitlement_repo
from app.schemas.billing import (
    PublicPlanCatalogResponse,
    PublicPlanEntitlement,
    PublicPlanPrice,
)
from app.services.entitlement_management_support import entitlement_value_from_row
from app.services.plan_pricing_service import BILLING_INTERVALS, price_for_interval


PURCHASABLE_PLAN_CODES = ("basic", "medium", "top", "mega")


def list_purchasable_plans(db: Session) -> list[PublicPlanCatalogResponse]:
    """Expose only customer-safe plan data, never provider credentials."""

    plans_by_code = {
        plan.code: plan
        for plan in entitlement_repo.list_active_plans(db)
        if plan.code in PURCHASABLE_PLAN_CODES
    }
    return [
        PublicPlanCatalogResponse(
            code=code,
            version=plan.version,
            entitlements=[
                PublicPlanEntitlement(
                    code=item.code,
                    value_type=item.value_type,
                    value=entitlement_value_from_row(item),
                )
                for item in sorted(plan.entitlements, key=lambda item: item.code)
            ],
            prices=[
                PublicPlanPrice(
                    billing_interval=interval,
                    amount_cents=price.amount_cents,
                    currency=price.currency,
                    tax_behavior=price.tax_behavior,
                    checkout_available=bool(
                        settings.BILLING_ENABLED
                        and settings.STRIPE_SECRET_KEY
                        and settings.stripe_price_id_for(code, interval)
                    ),
                )
                for interval in BILLING_INTERVALS
                if (price := price_for_interval(plan, interval)) is not None
            ],
        )
        for code in PURCHASABLE_PLAN_CODES
        if (plan := plans_by_code.get(code)) is not None
    ]
