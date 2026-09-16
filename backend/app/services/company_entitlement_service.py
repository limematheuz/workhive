"""Synchronize subscription history and auditable company-specific exceptions."""

from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.subscription_entitlement import (
    CompanyEntitlementOverride,
    CompanySubscription,
    EntitlementChangeAudit,
    PlanPrice,
)
from app.repositories import subscription_entitlement as entitlement_repo
from app.services.entitlement_catalog import (
    ALL_ENTITLEMENT_CODES,
    EntitlementValue,
    legacy_plan_code,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _billing_provider(company: Company) -> str | None:
    return (
        "stripe"
        if company.stripe_customer_id or company.stripe_subscription_id
        else None
    )


@dataclass(frozen=True)
class CommercialSubscriptionTerms:
    """The immutable agreed price for one subscription record."""

    billing_interval: str
    amount_cents: int
    currency: str
    tax_behavior: str
    effective_at: datetime


def commercial_terms_from_price(
    price: PlanPrice,
    *,
    effective_at: datetime,
) -> CommercialSubscriptionTerms:
    """Copy a versioned catalogue price into a paid subscription snapshot."""
    return CommercialSubscriptionTerms(
        billing_interval=price.billing_interval,
        amount_cents=price.amount_cents,
        currency=price.currency.upper(),
        tax_behavior=price.tax_behavior,
        effective_at=_as_utc(effective_at),
    )


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _validated_commercial_terms(
    terms: CommercialSubscriptionTerms,
) -> CommercialSubscriptionTerms:
    billing_interval = terms.billing_interval.strip()
    currency = terms.currency.strip().upper()
    tax_behavior = terms.tax_behavior.strip()
    if billing_interval not in {"monthly", "annual"}:
        raise ValueError("Commercial billing interval is invalid")
    if terms.amount_cents < 0:
        raise ValueError("Commercial amount cannot be negative")
    if len(currency) != 3 or not currency.isalpha():
        raise ValueError("Commercial currency must be a three-letter ISO code")
    if currency != "EUR":
        raise ValueError("WorkHive commercial terms currently support EUR only")
    if tax_behavior not in {"exclusive", "inclusive"}:
        raise ValueError("Commercial tax behavior is invalid")
    return CommercialSubscriptionTerms(
        billing_interval=billing_interval,
        amount_cents=terms.amount_cents,
        currency=currency,
        tax_behavior=tax_behavior,
        effective_at=_as_utc(terms.effective_at),
    )


def subscription_commercial_terms(
    subscription: CompanySubscription | None,
) -> CommercialSubscriptionTerms | None:
    """Read a complete snapshot without guessing missing legacy values."""
    if subscription is None:
        return None
    values = (
        subscription.commercial_billing_interval,
        subscription.commercial_amount_cents,
        subscription.commercial_currency,
        subscription.commercial_tax_behavior,
        subscription.commercial_terms_effective_at,
    )
    if any(value is None for value in values):
        return None
    return CommercialSubscriptionTerms(
        billing_interval=str(subscription.commercial_billing_interval),
        amount_cents=int(subscription.commercial_amount_cents),
        currency=str(subscription.commercial_currency),
        tax_behavior=str(subscription.commercial_tax_behavior),
        effective_at=_as_utc(subscription.commercial_terms_effective_at),
    )


def _terms_audit_value(
    terms: CommercialSubscriptionTerms | None,
) -> dict[str, object] | None:
    if terms is None:
        return None
    return {
        "billing_interval": terms.billing_interval,
        "amount_cents": terms.amount_cents,
        "currency": terms.currency,
        "tax_behavior": terms.tax_behavior,
        "effective_at": terms.effective_at.isoformat(),
    }


def _apply_commercial_terms(
    subscription: CompanySubscription,
    terms: CommercialSubscriptionTerms | None,
) -> None:
    if terms is None:
        return
    subscription.commercial_billing_interval = terms.billing_interval
    subscription.commercial_amount_cents = terms.amount_cents
    subscription.commercial_currency = terms.currency
    subscription.commercial_tax_behavior = terms.tax_behavior
    subscription.commercial_terms_effective_at = terms.effective_at


def synchronize_company_subscription(
    db: Session,
    company: Company,
    *,
    reason: str,
    actor_user_id: int | None = None,
    now: datetime | None = None,
    audit_action: str = "subscription.synchronized",
    plan_id: int | None = None,
    commercial_terms: CommercialSubscriptionTerms | None = None,
) -> CompanySubscription:
    current_time = now or _utcnow()
    normalized_terms = (
        _validated_commercial_terms(commercial_terms)
        if commercial_terms is not None
        else None
    )
    plan = (
        entitlement_repo.get_plan_by_id(db, plan_id=plan_id)
        if plan_id is not None
        else entitlement_repo.get_active_plan(
            db, code=legacy_plan_code(company.subscription_plan)
        )
    )
    if plan is None:
        raise RuntimeError("The WorkHive plan catalogue is not installed")
    current = entitlement_repo.get_latest_company_subscription(
        db, company_id=company.id
    )
    before = (
        {
            "plan_code": current.plan.code if current and current.plan else None,
            "status": current.status,
            "trial_ends_at": current.trial_ends_at.isoformat()
            if current and current.trial_ends_at
            else None,
            "commercial_terms": _terms_audit_value(
                subscription_commercial_terms(current)
            ),
        }
        if current
        else None
    )
    current_terms = subscription_commercial_terms(current)
    requires_new_snapshot = (
        normalized_terms is not None and normalized_terms != current_terms
    )
    if (
        current
        and current.plan_id == plan.id
        and current.ended_at is None
        and not requires_new_snapshot
    ):
        subscription = current
        subscription.status = company.subscription_status
        subscription.trial_ends_at = company.trial_ends_at
        subscription.billing_provider = _billing_provider(company)
        subscription.billing_customer_id = company.stripe_customer_id
        subscription.billing_subscription_id = company.stripe_subscription_id
    else:
        if current and current.ended_at is None:
            current.ended_at = current_time
            db.add(current)
        subscription = CompanySubscription(
            company_id=company.id,
            plan_id=plan.id,
            status=company.subscription_status,
            started_at=company.trial_started_at
            if company.subscription_status == "trialing" and company.trial_started_at
            else current_time,
            trial_ends_at=company.trial_ends_at,
            billing_provider=_billing_provider(company),
            billing_customer_id=company.stripe_customer_id,
            billing_subscription_id=company.stripe_subscription_id,
        )
        _apply_commercial_terms(subscription, normalized_terms)
        db.add(subscription)
        db.flush()
    after = {
        "plan_code": plan.code,
        "status": subscription.status,
        "trial_ends_at": subscription.trial_ends_at.isoformat()
        if subscription.trial_ends_at
        else None,
        "commercial_terms": _terms_audit_value(
            subscription_commercial_terms(subscription)
        ),
    }
    if before != after:
        db.add(
            EntitlementChangeAudit(
                company_id=company.id,
                company_subscription_id=subscription.id,
                actor_user_id=actor_user_id,
                action=audit_action,
                reason=reason,
                previous_value=before,
                next_value=after,
            )
        )
    db.flush()
    return subscription


def delete_company_entitlement_data(db: Session, *, company_id: int) -> None:
    """Remove plan history that cannot outlive a permanently deleted company.

    Permanent deletion is only available for an empty trial company.  Its plan
    history is derived operational data, so it must be deleted with the tenant
    instead of relying on ORM relationship defaults to null a required foreign
    key.
    """
    db.query(EntitlementChangeAudit).filter(
        EntitlementChangeAudit.company_id == company_id
    ).delete(synchronize_session=False)
    db.query(CompanyEntitlementOverride).filter(
        CompanyEntitlementOverride.company_id == company_id
    ).delete(synchronize_session=False)
    db.query(CompanySubscription).filter(
        CompanySubscription.company_id == company_id
    ).delete(synchronize_session=False)


def set_company_entitlement_override(
    db: Session,
    *,
    company_id: int,
    code: str,
    value: EntitlementValue,
    reason: str,
    actor_user_id: int | None,
    starts_at: datetime | None = None,
    ends_at: datetime | None = None,
) -> CompanyEntitlementOverride:
    if code not in ALL_ENTITLEMENT_CODES:
        raise ValueError(f"Unknown entitlement code: {code}")
    expects_boolean = code.startswith("features.")
    if expects_boolean != isinstance(value, bool):
        raise ValueError(
            f"Entitlement {code} requires a {'boolean' if expects_boolean else 'integer'} value"
        )
    if isinstance(value, int) and not isinstance(value, bool) and value < 0:
        raise ValueError("Quota overrides cannot be negative")
    if not reason.strip():
        raise ValueError("An override reason is required")
    current_time = starts_at or _utcnow()
    if ends_at and ends_at < current_time:
        raise ValueError("An override cannot end before it starts")
    if entitlement_repo.lock_company(db, company_id=company_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
        )
    for prior in entitlement_repo.list_open_overrides(
        db, company_id=company_id, code=code, now=current_time
    ):
        prior.ends_at = current_time
        db.add(prior)
    override = CompanyEntitlementOverride(
        company_id=company_id,
        code=code,
        value_type="boolean" if expects_boolean else "integer",
        boolean_value=value if expects_boolean else None,
        integer_value=value if not expects_boolean else None,
        reason=reason.strip(),
        starts_at=current_time,
        ends_at=ends_at,
        configured_by_user_id=actor_user_id,
    )
    db.add(override)
    db.flush()
    db.add(
        EntitlementChangeAudit(
            company_id=company_id,
            company_entitlement_override_id=override.id,
            actor_user_id=actor_user_id,
            action="entitlement.override_set",
            reason=override.reason,
            next_value={
                "code": code,
                "value": value,
                "starts_at": current_time.isoformat(),
                "ends_at": ends_at.isoformat() if ends_at else None,
            },
        )
    )
    db.flush()
    return override
