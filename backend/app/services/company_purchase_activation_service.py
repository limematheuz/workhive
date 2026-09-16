"""Activate a confirmed company purchase through a one-time owner link."""

import hashlib
import logging
import smtplib
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.company import Company
from app.models.company_purchase_intent import CompanyPurchaseIntent
from app.models.user import User
from app.repositories import company as company_repo
from app.repositories import company_purchase_intent as purchase_repo
from app.repositories import role as role_repo
from app.repositories import subscription_entitlement as entitlement_repo
from app.repositories import user as user_repo
from app.schemas.billing import CompanyPurchaseActivation
from app.services import (
    company_entitlement_service,
    email_service,
    organization_bootstrap_service,
    privacy_service,
)
from app.services.entitlement_catalog import plan_label
from app.services.plan_pricing_service import require_price_for_interval


logger = logging.getLogger(__name__)
ACTIVATION_TOKEN_TTL = timedelta(days=7)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def hash_activation_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def deliver_activation_email(
    db: Session,
    *,
    purchase: CompanyPurchaseIntent,
    activation_token: str,
) -> bool:
    activation_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/activate-purchase?token={activation_token}"
    )
    try:
        sent = email_service.send_paid_company_activation_email(
            recipient_email=purchase.owner_email,
            recipient_name=purchase.owner_full_name,
            company_name=purchase.company_name,
            plan_name=plan_label(purchase.plan_code),
            activation_url=activation_url,
        )
    except (OSError, TimeoutError, ConnectionError, smtplib.SMTPException):
        logger.exception("Paid company activation email delivery failed")
        return False
    if not sent:
        logger.warning("Paid company activation email was not sent")
        return False
    purchase.activation_email_sent_at = utcnow()
    db.add(purchase)
    db.commit()
    return True


def activate_paid_purchase(
    db: Session,
    *,
    payload: CompanyPurchaseActivation,
    request: Request,
) -> tuple[Company, User]:
    purchase = purchase_repo.get_by_activation_token_hash(
        db,
        token_hash=hash_activation_token(payload.token),
        lock=True,
    )
    if purchase is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This purchase activation link is invalid",
        )
    now = utcnow()
    expires_at = purchase.activation_expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at <= now:
        purchase.status = "expired"
        db.add(purchase)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This purchase activation link has expired",
        )
    if purchase.status == "activated":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This purchase has already activated a WorkHive company",
        )
    if purchase.status != "paid":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The payment has not been confirmed yet",
        )
    if company_repo.get_company_by_tax_id(db, purchase.tax_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A WorkHive company already uses this tax ID",
        )
    if user_repo.get_user_by_email(db, purchase.owner_email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This owner email already has a WorkHive account",
        )
    plan = entitlement_repo.get_plan_by_id(db, plan_id=purchase.plan_id)
    if plan is None or plan.code != purchase.plan_code:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The purchased plan is no longer available",
        )
    purchased_price = require_price_for_interval(plan, purchase.billing_interval)
    admin_role = role_repo.get_role_by_name(db, "admin")
    if admin_role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Role 'admin' is not configured",
        )

    try:
        company = Company(
            name=purchase.company_name,
            tax_id=purchase.tax_id,
            address=purchase.address,
            postal_code=purchase.postal_code,
            city=purchase.city,
            province=purchase.province,
            phone=purchase.phone,
            email=purchase.company_email,
            is_active=True,
            onboarding_completed=False,
            subscription_plan=purchase.plan_code,
            subscription_status="active",
            stripe_customer_id=purchase.stripe_customer_id,
            stripe_subscription_id=purchase.stripe_subscription_id,
        )
        db.add(company)
        db.flush()
        owner = User(
            email=purchase.owner_email,
            hashed_password=get_password_hash(payload.password),
            full_name=purchase.owner_full_name,
            is_active=True,
            email_verified_at=now,
            role_id=admin_role.id,
            company_id=company.id,
        )
        db.add(owner)
        db.flush()
        organization_bootstrap_service.ensure_user_membership(db, owner)
        company_entitlement_service.synchronize_company_subscription(
            db,
            company,
            reason="company_purchase.activated",
            actor_user_id=owner.id,
            now=now,
            plan_id=plan.id,
            commercial_terms=company_entitlement_service.commercial_terms_from_price(
                purchased_price,
                effective_at=now,
            ),
        )
        privacy_service.record_registration_acknowledgements(
            db,
            user=owner,
            request=request,
            policy_version=purchase.privacy_policy_version,
            marketing_consent=purchase.marketing_consent,
            commit=False,
        )
        purchase.status = "activated"
        purchase.activated_at = now
        purchase.activated_company_id = company.id
        purchase.activated_user_id = owner.id
        db.add(purchase)
        db.commit()
        db.refresh(company)
        db.refresh(owner)
        return company, owner
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The company or owner account could not be activated",
        ) from error
    except Exception:
        db.rollback()
        raise
