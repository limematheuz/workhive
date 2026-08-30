"""Create a paid company only after a hosted checkout is confirmed."""

import secrets
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.company_purchase_intent import CompanyPurchaseIntent
from app.repositories import company as company_repo
from app.repositories import company_purchase_intent as purchase_repo
from app.repositories import subscription_entitlement as entitlement_repo
from app.repositories import user as user_repo
from app.schemas.billing import CompanyPurchaseCheckout
from app.services.company_purchase_activation_service import (
    ACTIVATION_TOKEN_TTL,
    hash_activation_token,
    utcnow,
)


PURCHASABLE_PLAN_CODES = frozenset({"basic", "medium", "top", "mega"})


@dataclass(frozen=True)
class PurchaseStripeEvent:
    intent: CompanyPurchaseIntent
    activation_token: str | None = None


def _string(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _purchase_id_from_stripe_object(stripe_object: dict[str, Any]) -> str | None:
    metadata = stripe_object.get("metadata") or {}
    purchase_id = _string(metadata.get("company_purchase_id"))
    if purchase_id:
        return purchase_id
    subscription_details = stripe_object.get("subscription_details") or {}
    subscription_metadata = subscription_details.get("metadata") or {}
    purchase_id = _string(subscription_metadata.get("company_purchase_id"))
    if purchase_id:
        return purchase_id
    parent = stripe_object.get("parent") or {}
    parent_subscription_details = parent.get("subscription_details") or {}
    parent_metadata = parent_subscription_details.get("metadata") or {}
    return _string(parent_metadata.get("company_purchase_id"))


def _stripe_subscription_id(stripe_object: dict[str, Any]) -> str | None:
    subscription_id = _string(stripe_object.get("subscription"))
    if subscription_id:
        return subscription_id
    parent = stripe_object.get("parent") or {}
    subscription_details = parent.get("subscription_details") or {}
    return _string(subscription_details.get("subscription"))


def create_purchase_intent(
    db: Session,
    payload: CompanyPurchaseCheckout,
) -> CompanyPurchaseIntent:
    if payload.plan not in PURCHASABLE_PLAN_CODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This plan requires a tailored commercial proposal",
        )
    plan = entitlement_repo.get_active_plan(db, code=payload.plan)
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This plan is not available for purchase",
        )
    if company_repo.get_company_by_tax_id(db, payload.tax_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A WorkHive company already uses this tax ID",
        )
    if user_repo.get_user_by_email(db, str(payload.owner_email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This owner email already has a WorkHive account. Sign in to manage that company instead.",
        )

    purchase = CompanyPurchaseIntent(
        plan_id=plan.id,
        plan_code=plan.code,
        plan_version=plan.version,
        company_name=payload.company_name,
        tax_id=payload.tax_id,
        address=payload.address,
        postal_code=payload.postal_code,
        city=payload.city,
        province=payload.province,
        phone=payload.phone,
        company_email=str(payload.company_email).lower(),
        owner_full_name=payload.owner_full_name,
        owner_email=str(payload.owner_email).lower(),
        marketing_consent=payload.marketing_consent,
        privacy_policy_version=settings.PRIVACY_POLICY_VERSION,
        status="checkout_created",
    )
    db.add(purchase)
    # Commit before the external Stripe request. Its metadata can then always
    # be reconciled by a webhook, even if the response reaches us late.
    db.commit()
    db.refresh(purchase)
    return purchase


def attach_stripe_checkout_session(
    db: Session,
    *,
    purchase: CompanyPurchaseIntent,
    stripe_session: dict[str, Any],
) -> CompanyPurchaseIntent:
    checkout_session_id = _string(stripe_session.get("id"))
    if not checkout_session_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stripe returned an invalid checkout session",
        )
    purchase.stripe_checkout_session_id = checkout_session_id
    purchase.stripe_customer_id = _string(stripe_session.get("customer"))
    purchase.stripe_subscription_id = _string(stripe_session.get("subscription"))
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return purchase


def apply_stripe_event(
    db: Session,
    *,
    event_type: str,
    stripe_object: dict[str, Any],
) -> PurchaseStripeEvent | None:
    purchase_id = _purchase_id_from_stripe_object(stripe_object)
    purchase = (
        purchase_repo.get_by_id(db, purchase_id=purchase_id, lock=True)
        if purchase_id
        else None
    )
    if purchase is None and event_type == "invoice.paid":
        subscription_id = _stripe_subscription_id(stripe_object)
        if subscription_id:
            purchase = purchase_repo.get_by_stripe_subscription(
                db, subscription_id=subscription_id, lock=True
            )
    if purchase is None and event_type.startswith("checkout.session."):
        checkout_session_id = _string(stripe_object.get("id"))
        if checkout_session_id:
            purchase = purchase_repo.get_by_stripe_checkout_session(
                db, checkout_session_id=checkout_session_id, lock=True
            )
    if purchase is None:
        return None

    if purchase.status in {"activated", "expired", "canceled"}:
        return PurchaseStripeEvent(intent=purchase)

    checkout_session_id = _string(stripe_object.get("id"))
    if event_type.startswith("checkout.session."):
        if (
            purchase.stripe_checkout_session_id
            and checkout_session_id
            and purchase.stripe_checkout_session_id != checkout_session_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Stripe checkout does not match the purchase request",
            )
        purchase.stripe_checkout_session_id = (
            checkout_session_id or purchase.stripe_checkout_session_id
        )
        purchase.stripe_customer_id = _string(stripe_object.get("customer"))
        purchase.stripe_subscription_id = _string(stripe_object.get("subscription"))
        if event_type == "checkout.session.expired":
            purchase.status = "expired"
        elif event_type == "checkout.session.completed":
            purchase.status = "checkout_completed"
        if (
            event_type == "checkout.session.async_payment_succeeded"
            or (
                event_type == "checkout.session.completed"
                and stripe_object.get("payment_status") == "paid"
            )
        ):
            return _mark_paid(db, purchase)
    elif event_type.startswith("customer.subscription."):
        purchase.stripe_customer_id = _string(stripe_object.get("customer"))
        purchase.stripe_subscription_id = _string(stripe_object.get("id"))
        if event_type == "customer.subscription.deleted":
            purchase.status = "canceled"
    elif event_type == "invoice.paid":
        purchase.stripe_customer_id = _string(stripe_object.get("customer"))
        purchase.stripe_subscription_id = (
            _stripe_subscription_id(stripe_object)
            or purchase.stripe_subscription_id
        )
        return _mark_paid(db, purchase)

    db.add(purchase)
    db.flush()
    return PurchaseStripeEvent(intent=purchase)


def _mark_paid(db: Session, purchase: CompanyPurchaseIntent) -> PurchaseStripeEvent:
    purchase.status = "paid"
    purchase.payment_confirmed_at = purchase.payment_confirmed_at or utcnow()
    activation_token: str | None = None
    if purchase.activation_email_sent_at is None:
        activation_token = secrets.token_urlsafe(32)
        purchase.activation_token_hash = hash_activation_token(activation_token)
        purchase.activation_expires_at = utcnow() + ACTIVATION_TOKEN_TTL
    db.add(purchase)
    db.flush()
    return PurchaseStripeEvent(intent=purchase, activation_token=activation_token)
