"""Resolve a company's effective plan access and enforce its quotas."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.subscription_entitlement import (
    CompanyEntitlementOverride,
    PlanEntitlement,
)
from app.repositories import subscription_entitlement as entitlement_repo
from app.services.entitlement_catalog import (
    ALL_ENTITLEMENT_CODES,
    EntitlementValue,
    default_plan_values,
    legacy_plan_code,
)


@dataclass(frozen=True)
class EffectiveEntitlements:
    plan_code: str
    values: dict[str, EntitlementValue]
    source: str


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _value_from_entitlement(entitlement: PlanEntitlement) -> EntitlementValue:
    if entitlement.value_type == "boolean":
        return bool(entitlement.boolean_value)
    if entitlement.value_type == "integer" and entitlement.integer_value is not None:
        return int(entitlement.integer_value)
    raise RuntimeError(f"Invalid persisted entitlement {entitlement.code}")


def _value_from_override(override: CompanyEntitlementOverride) -> EntitlementValue:
    if override.value_type == "boolean":
        return bool(override.boolean_value)
    if override.value_type == "integer" and override.integer_value is not None:
        return int(override.integer_value)
    raise RuntimeError(f"Invalid persisted entitlement override {override.id}")


def resolve_effective_entitlements(
    db: Session, company: Company, *, now: datetime | None = None
) -> EffectiveEntitlements:
    current_time = now or _utcnow()
    subscription = entitlement_repo.get_latest_company_subscription(
        db, company_id=company.id
    )
    if subscription and subscription.plan:
        values = {
            item.code: _value_from_entitlement(item)
            for item in subscription.plan.entitlements
        }
        plan_code = subscription.plan.code
        source = "subscription"
    else:
        plan_code = legacy_plan_code(company.subscription_plan)
        values = default_plan_values(plan_code)
        source = "legacy_subscription"
    seen_codes: set[str] = set()
    for override in entitlement_repo.list_active_overrides(
        db, company_id=company.id, now=current_time
    ):
        if override.code not in seen_codes:
            values[override.code] = _value_from_override(override)
            seen_codes.add(override.code)
    return EffectiveEntitlements(plan_code=plan_code, values=values, source=source)


def entitlement_value(
    db: Session, company: Company, code: str, *, now: datetime | None = None
) -> EntitlementValue:
    if code not in ALL_ENTITLEMENT_CODES:
        raise ValueError(f"Unknown entitlement code: {code}")
    return resolve_effective_entitlements(db, company, now=now).values.get(
        code, False if code.startswith("features.") else 0
    )


def require_feature(db: Session, company: Company, code: str) -> None:
    if entitlement_value(db, company, code) is True:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="This feature is not included in the current plan",
        headers={"X-WorkHive-Error-Code": "entitlement.feature_not_in_plan"},
    )


def require_company_feature(db: Session, *, company_id: int, code: str) -> None:
    """Enforce a feature without leaking a company record across tenant boundaries."""
    company = entitlement_repo.get_company(db, company_id=company_id)
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )
    require_feature(db, company, code)


def company_feature_enabled(db: Session, *, company_id: int, code: str) -> bool:
    """Return whether an asynchronous company workflow may use a feature.

    Background work has no requesting user to authorize, but it must honor the
    same commercial access as an interactive request. Missing companies are
    treated as disabled so a stale queued job cannot revive access.
    """
    company = entitlement_repo.get_company(db, company_id=company_id)
    return bool(company and entitlement_value(db, company, code) is True)


def _require_quota(
    db: Session,
    *,
    company_id: int,
    code: str,
    count_current: Callable[[], int],
    resource_label: str,
) -> None:
    company = entitlement_repo.lock_company(db, company_id=company_id)
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
        )
    limit = entitlement_value(db, company, code)
    if not isinstance(limit, int) or isinstance(limit, bool):
        raise RuntimeError(f"Entitlement {code} is not an integer quota")
    if count_current() < limit:
        return
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"Your plan allows up to {limit} active {resource_label}. Change the plan or reduce the current usage before continuing.",
        headers={"X-WorkHive-Error-Code": "entitlement.quota_reached"},
    )


def require_internal_member_capacity(
    db: Session,
    *,
    company_id: int,
    access_class: str,
    exclude_membership_id: int | None = None,
) -> None:
    quota = {
        "admin": ("limits.internal_admins", "administrators"),
        "responsible": ("limits.internal_responsibles", "responsibles"),
        "worker": ("limits.internal_workers", "workers"),
    }.get(access_class)
    if quota is None:
        raise ValueError(f"Unknown internal access class: {access_class}")
    code, label = quota
    _require_quota(
        db,
        company_id=company_id,
        code=code,
        count_current=lambda: entitlement_repo.count_active_memberships(
            db,
            company_id=company_id,
            access_class=access_class,
            exclude_membership_id=exclude_membership_id,
        ),
        resource_label=label,
    )


def require_accountant_portal_capacity(
    db: Session,
    *,
    company_id: int,
) -> None:
    """Reserve a portal entitlement without consuming an internal seat."""

    now = _utcnow()
    _require_quota(
        db,
        company_id=company_id,
        code="limits.accountant_portals",
        count_current=lambda: entitlement_repo.count_active_external_access_grants(
            db,
            company_id=company_id,
            access_type="accountant",
            now=now,
        ),
        resource_label="accountant portal users",
    )


def require_department_capacity(db: Session, *, company_id: int) -> None:
    _require_quota(
        db,
        company_id=company_id,
        code="limits.departments",
        count_current=lambda: entitlement_repo.count_active_departments(
            db, company_id=company_id
        ),
        resource_label="departments",
    )


def require_team_capacity(db: Session, *, company_id: int) -> None:
    _require_quota(
        db,
        company_id=company_id,
        code="limits.teams",
        count_current=lambda: entitlement_repo.count_active_teams(
            db, company_id=company_id
        ),
        resource_label="teams",
    )
