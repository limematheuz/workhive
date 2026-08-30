import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.company import Company
from app.models.stripe_webhook_event import StripeWebhookEvent
from app.services import company_entitlement_service
from app.services.entitlement_catalog import legacy_plan_code


STRIPE_API_URL = "https://api.stripe.com/v1"
_CHECKOUT_PLAN_CODES = frozenset(
    {"basic", "medium", "top", "mega", "business", "pro", "lifetime"}
)


def _require_billing_configuration() -> None:
    if not settings.BILLING_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not enabled yet",
        )
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured",
        )


def _stripe_post(path: str, data: dict[str, str]) -> dict[str, Any]:
    _require_billing_configuration()
    try:
        response = httpx.post(
            f"{STRIPE_API_URL}{path}",
            data=data,
            headers={"Authorization": f"Bearer {settings.STRIPE_SECRET_KEY}"},
            timeout=15,
        )
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe could not process the request",
        ) from exc


def create_checkout_session(company: Company, plan: str) -> str:
    requested_plan = plan.strip().lower()
    if requested_plan not in _CHECKOUT_PLAN_CODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The requested plan is not available for checkout",
        )
    canonical_plan = legacy_plan_code(requested_plan)
    # Keep already-created lifetime checkout links working only while the
    # public pricing page is migrated. The subscription itself still becomes
    # canonical Top when Stripe confirms payment.
    is_legacy_lifetime = requested_plan == "lifetime"
    price_id = (
        settings.STRIPE_LIFETIME_PRICE_ID
        if is_legacy_lifetime
        else settings.stripe_price_ids.get(canonical_plan)
    )
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Stripe price is not configured for plan {canonical_plan}",
        )

    frontend_url = settings.FRONTEND_URL.rstrip("/")
    is_one_time = is_legacy_lifetime
    payload = {
        "mode": "payment" if is_one_time else "subscription",
        "line_items[0][price]": price_id,
        "line_items[0][quantity]": "1",
        "success_url": f"{frontend_url}/dashboard/profile?billing=success",
        "cancel_url": f"{frontend_url}/subscription?billing=canceled",
        "client_reference_id": str(company.id),
        "customer_email": company.email,
        "metadata[company_id]": str(company.id),
        "metadata[plan]": canonical_plan,
        "allow_promotion_codes": "true",
    }
    if not is_one_time:
        payload["subscription_data[metadata][company_id]"] = str(company.id)
        payload["subscription_data[metadata][plan]"] = canonical_plan
    session = _stripe_post("/checkout/sessions", payload)
    checkout_url = session.get("url")
    if not checkout_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe returned an invalid checkout session",
        )
    return str(checkout_url)


def create_customer_portal(company: Company) -> str:
    if not company.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This company does not have a Stripe customer yet",
        )
    portal = _stripe_post(
        "/billing_portal/sessions",
        {
            "customer": company.stripe_customer_id,
            "return_url": f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/profile",
        },
    )
    portal_url = portal.get("url")
    if not portal_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe returned an invalid portal session",
        )
    return str(portal_url)


def verify_webhook_signature(
    payload: bytes,
    signature_header: str,
    *,
    tolerance_seconds: int = 300,
) -> None:
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe webhook is not configured",
        )

    signature_parts: dict[str, list[str]] = {}
    for part in signature_header.split(","):
        key, _, value = part.partition("=")
        if key and value:
            signature_parts.setdefault(key, []).append(value)

    try:
        timestamp = int(signature_parts["t"][0])
        signatures = signature_parts["v1"]
    except (KeyError, ValueError, IndexError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe signature header",
        ) from exc

    if abs(int(time.time()) - timestamp) > tolerance_seconds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expired Stripe signature",
        )

    signed_payload = f"{timestamp}.".encode() + payload
    expected = hmac.new(
        settings.STRIPE_WEBHOOK_SECRET.encode(),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()
    if not any(hmac.compare_digest(expected, signature) for signature in signatures):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe signature",
        )


def _company_from_stripe_object(
    db: Session,
    stripe_object: dict[str, Any],
) -> Company | None:
    metadata = stripe_object.get("metadata") or {}
    company_id = metadata.get("company_id") or stripe_object.get("client_reference_id")
    if company_id:
        try:
            return db.query(Company).filter(Company.id == int(company_id)).first()
        except (TypeError, ValueError):
            return None

    customer_id = stripe_object.get("customer")
    if customer_id:
        return (
            db.query(Company)
            .filter(Company.stripe_customer_id == str(customer_id))
            .first()
        )
    return None


def _datetime_from_unix(timestamp: Any) -> datetime | None:
    if not timestamp:
        return None
    try:
        return datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def process_webhook(db: Session, payload: bytes, signature_header: str) -> str:
    if not settings.BILLING_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is disabled",
        )
    verify_webhook_signature(payload, signature_header)
    try:
        event = json.loads(payload)
        event_id = str(event["id"])
        event_type = str(event["type"])
        stripe_object = event["data"]["object"]
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe webhook payload",
        ) from exc

    existing_event = (
        db.query(StripeWebhookEvent)
        .filter(StripeWebhookEvent.event_id == event_id)
        .first()
    )
    if existing_event:
        return existing_event.event_type

    webhook_event = StripeWebhookEvent(
        event_id=event_id,
        event_type=event_type,
    )
    db.add(webhook_event)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return event_type

    company = _company_from_stripe_object(db, stripe_object)
    if not company:
        db.commit()
        return event_type

    if event_type == "checkout.session.completed":
        company.stripe_customer_id = stripe_object.get("customer")
        company.stripe_subscription_id = stripe_object.get("subscription")
        metadata = stripe_object.get("metadata") or {}
        plan = legacy_plan_code(metadata.get("plan", company.subscription_plan))
        company.subscription_plan = plan
        # One-time lifetime purchases have no subscription invoices to mark active.
        if stripe_object.get("mode") == "payment":
            company.subscription_status = "active"
        else:
            company.subscription_status = "pending"
    elif event_type.startswith("customer.subscription."):
        company.stripe_customer_id = stripe_object.get("customer")
        company.stripe_subscription_id = stripe_object.get("id")
        metadata = stripe_object.get("metadata") or {}
        company.subscription_plan = legacy_plan_code(
            metadata.get("plan", company.subscription_plan)
        )
        company.subscription_status = stripe_object.get("status", "inactive")
        company.trial_ends_at = _datetime_from_unix(stripe_object.get("trial_end"))
        if event_type == "customer.subscription.deleted":
            company.subscription_status = "canceled"
    elif event_type == "invoice.paid":
        company.subscription_status = "active"
    elif event_type == "invoice.payment_failed":
        company.subscription_status = "past_due"
    else:
        db.commit()
        return event_type

    db.add(company)
    company_entitlement_service.synchronize_company_subscription(
        db,
        company,
        reason=f"stripe.{event_type}",
    )
    db.commit()
    return event_type
