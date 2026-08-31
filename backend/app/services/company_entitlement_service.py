"""Synchronize subscription history and auditable company-specific exceptions."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.subscription_entitlement import (
    CompanyEntitlementOverride,
    CompanySubscription,
    EntitlementChangeAudit,
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


def synchronize_company_subscription(
    db: Session,
    company: Company,
    *,
    reason: str,
    actor_user_id: int | None = None,
    now: datetime | None = None,
    audit_action: str = "subscription.synchronized",
    plan_id: int | None = None,
) -> CompanySubscription:
    current_time = now or _utcnow()
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
        }
        if current
        else None
    )
    if current and current.plan_id == plan.id and current.ended_at is None:
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
        db.add(subscription)
        db.flush()
    after = {
        "plan_code": plan.code,
        "status": subscription.status,
        "trial_ends_at": subscription.trial_ends_at.isoformat()
        if subscription.trial_ends_at
        else None,
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
