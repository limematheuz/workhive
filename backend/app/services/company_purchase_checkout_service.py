"""Create hosted Stripe Checkout sessions for a new paid company."""

from typing import Any, Callable

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.billing import CompanyPurchaseCheckout
from app.services import company_purchase_service


StripePost = Callable[[str, dict[str, str]], dict[str, Any]]


def create_company_purchase_checkout(
    db: Session,
    checkout: CompanyPurchaseCheckout,
    *,
    stripe_post: StripePost,
) -> str:
    """Persist a purchase intent and return Stripe's hosted payment URL."""

    price_id = settings.stripe_price_ids.get(checkout.plan)
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Stripe price is not configured for plan {checkout.plan}",
        )
    purchase = company_purchase_service.create_purchase_intent(db, checkout)
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    session = stripe_post(
        "/checkout/sessions",
        {
            "mode": "subscription",
            "line_items[0][price]": price_id,
            "line_items[0][quantity]": "1",
            "success_url": f"{frontend_url}/subscription/purchase-complete?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{frontend_url}/subscription?billing=canceled",
            "client_reference_id": purchase.id,
            "customer_email": purchase.owner_email,
            "metadata[company_purchase_id]": purchase.id,
            "metadata[plan]": purchase.plan_code,
            "allow_promotion_codes": "true",
            "subscription_data[metadata][company_purchase_id]": purchase.id,
            "subscription_data[metadata][plan]": purchase.plan_code,
        },
    )
    checkout_url = session.get("url")
    if not checkout_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe returned an invalid checkout session",
        )
    company_purchase_service.attach_stripe_checkout_session(
        db,
        purchase=purchase,
        stripe_session=session,
    )
    return str(checkout_url)
