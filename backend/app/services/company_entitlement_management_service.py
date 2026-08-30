"""Platform-only administration of a company's commercial plan and exceptions."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.subscription_entitlement import (
    CompanyEntitlementOverride,
    EntitlementChangeAudit,
)
from app.models.user import User
from app.repositories import subscription_entitlement as entitlement_repo
from app.repositories import user as user_repo
from app.schemas.company_entitlement_management import (
    CompanyEntitlementOverrideCreate,
    CompanyEntitlementCustomizationUpdate,
    CompanyEntitlementOverrideResponse,
    CompanyEntitlementUsageResponse,
    CompanyPlanAccessResponse,
    CompanyPlanAccessUpdate,
    CompanySubscriptionAccessResponse,
    CurrentCompanyEntitlementsResponse,
    EntitlementAuditResponse,
)
from app.services import company_entitlement_service, entitlement_service
from app.services.company_entitlement_safety_service import (
    override_value,
    reject_capacity_below_current_usage,
    values_with_active_overrides,
)
from app.services.entitlement_catalog import (
    ALL_ENTITLEMENT_CODES,
    EntitlementValue,
    entitlement_presentation,
    plan_label,
)
from app.services.entitlement_management_support import (
    current_plan_values,
    entitlement_response,
    entitlement_value_from_row,
    utcnow,
    validate_entitlement_values,
)
from app.services.user_scope import require_company_context, require_platform_superadmin


def _get_company(db: Session, *, company_id: int) -> Company:
    company = entitlement_repo.get_company(db, company_id=company_id)
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se ha encontrado la empresa solicitada",
        )
    return company


def _lock_company(db: Session, *, company_id: int) -> Company:
    company = entitlement_repo.lock_company(db, company_id=company_id)
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se ha encontrado la empresa solicitada",
        )
    return company


def get_current_company_entitlements(
    db: Session, current_user: User
) -> CurrentCompanyEntitlementsResponse:
    company_id = require_company_context(current_user)
    company = _get_company(db, company_id=company_id)
    effective = entitlement_service.resolve_effective_entitlements(db, company)
    return CurrentCompanyEntitlementsResponse(
        entitlements=[
            entitlement_response(code, effective.values[code], source="plan")
            for code in sorted(ALL_ENTITLEMENT_CODES)
        ]
    )


def get_company_plan_access(
    db: Session, *, company_id: int, current_user: User
) -> CompanyPlanAccessResponse:
    require_platform_superadmin(current_user)
    company = _get_company(db, company_id=company_id)
    effective = entitlement_service.resolve_effective_entitlements(db, company)
    base_values, plan_version = current_plan_values(db, company)
    now = utcnow()
    overrides = entitlement_repo.list_active_overrides(
        db, company_id=company.id, now=now
    )
    overridden_codes = {override.code for override in overrides}
    return CompanyPlanAccessResponse(
        company_id=company.id,
        subscription=CompanySubscriptionAccessResponse(
            plan_code=effective.plan_code,
            plan_label=plan_label(effective.plan_code),
            plan_version=plan_version,
            status=company.subscription_status,
            trial_ends_at=company.trial_ends_at,
        ),
        entitlements=[
            entitlement_response(
                code,
                effective.values[code],
                source="exception" if code in overridden_codes else "plan",
            )
            for code in sorted(ALL_ENTITLEMENT_CODES)
        ],
        base_entitlements=[
            entitlement_response(code, base_values[code], source="plan")
            for code in sorted(ALL_ENTITLEMENT_CODES)
        ],
        overrides=[_override_response(override) for override in overrides],
        audit=[
            EntitlementAuditResponse(
                id=item.id,
                action=item.action,
                reason=item.reason,
                created_at=item.created_at,
            )
            for item in entitlement_repo.list_company_entitlement_audit(
                db, company_id=company.id
            )
        ],
        usage=CompanyEntitlementUsageResponse(
            administrators=entitlement_repo.count_active_memberships(
                db, company_id=company.id, access_class="admin"
            ),
            managers=entitlement_repo.count_active_memberships(
                db, company_id=company.id, access_class="responsible"
            ),
            workers=entitlement_repo.count_active_memberships(
                db, company_id=company.id, access_class="worker"
            ),
            departments=entitlement_repo.count_active_departments(
                db, company_id=company.id
            ),
            teams=entitlement_repo.count_active_teams(db, company_id=company.id),
        ),
    )


def update_company_plan_access(
    db: Session,
    *,
    company_id: int,
    update: CompanyPlanAccessUpdate,
    current_user: User,
) -> CompanyPlanAccessResponse:
    require_platform_superadmin(current_user)
    company = _lock_company(db, company_id=company_id)
    now = utcnow()
    if update.status == "trialing" and update.trial_ends_at <= now:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La fecha de finalización de la prueba debe ser futura",
        )
    target_plan = entitlement_repo.get_active_plan(db, code=update.plan_code)
    if target_plan is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El catálogo de planes de WorkHive no está instalado",
        )
    target_values = {
        item.code: entitlement_value_from_row(item) for item in target_plan.entitlements
    }
    active_overrides = entitlement_repo.list_active_overrides(
        db, company_id=company.id, now=now
    )
    reject_capacity_below_current_usage(
        db,
        company_id=company.id,
        values=values_with_active_overrides(target_values, active_overrides),
    )
    if any(override.ends_at is not None for override in active_overrides):
        reject_capacity_below_current_usage(
            db,
            company_id=company.id,
            values=values_with_active_overrides(
                target_values, active_overrides, include_temporary=False
            ),
            when="La fecha de finalización de una excepción activa",
        )
    company.subscription_plan = update.plan_code
    company.subscription_status = update.status
    company.trial_started_at = now if update.status == "trialing" else None
    company.trial_ends_at = update.trial_ends_at
    db.add(company)
    company_entitlement_service.synchronize_company_subscription(
        db,
        company,
        reason=update.reason,
        actor_user_id=current_user.id,
        now=now,
        audit_action="subscription.manually_changed",
    )
    user_repo.revoke_company_sessions(db, company_id=company.id)
    db.commit()
    return get_company_plan_access(db, company_id=company.id, current_user=current_user)


def create_company_entitlement_override(
    db: Session,
    *,
    company_id: int,
    override_data: CompanyEntitlementOverrideCreate,
    current_user: User,
) -> CompanyEntitlementOverrideResponse:
    require_platform_superadmin(current_user)
    company = _lock_company(db, company_id=company_id)
    value: EntitlementValue = (
        override_data.boolean_value
        if override_data.boolean_value is not None
        else int(override_data.integer_value or 0)
    )
    now = utcnow()
    base_values, _ = current_plan_values(db, company)
    active_overrides = entitlement_repo.list_active_overrides(
        db, company_id=company.id, now=now
    )
    remaining_overrides = [
        override for override in active_overrides if override.code != override_data.code
    ]
    proposed_values = values_with_active_overrides(base_values, remaining_overrides)
    proposed_values[override_data.code] = value
    reject_capacity_below_current_usage(
        db, company_id=company.id, values=proposed_values
    )
    if override_data.ends_at is not None:
        reject_capacity_below_current_usage(
            db,
            company_id=company.id,
            values=values_with_active_overrides(
                base_values, remaining_overrides, include_temporary=False
            ),
            when="La fecha de finalización de esta excepción",
        )
    try:
        override = company_entitlement_service.set_company_entitlement_override(
            db,
            company_id=company_id,
            code=override_data.code,
            value=value,
            reason=override_data.reason,
            actor_user_id=current_user.id,
            ends_at=override_data.ends_at,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error
    user_repo.revoke_company_sessions(db, company_id=company_id)
    db.commit()
    return _override_response(override)


def replace_company_entitlement_customization(
    db: Session,
    *,
    company_id: int,
    update: CompanyEntitlementCustomizationUpdate,
    current_user: User,
) -> CompanyPlanAccessResponse:
    require_platform_superadmin(current_user)
    company = _lock_company(db, company_id=company_id)
    try:
        values = validate_entitlement_values(update.entitlements)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error

    now = utcnow()
    if update.ends_at and update.ends_at <= now:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La fecha de finalización de la configuración personalizada debe ser futura",
        )
    base_values, _ = current_plan_values(db, company)
    current_overrides = entitlement_repo.list_active_overrides(
        db, company_id=company.id, now=now
    )
    previous_values = {item.code: override_value(item) for item in current_overrides}
    reject_capacity_below_current_usage(
        db, company_id=company.id, values=values
    )
    if update.ends_at is not None:
        reject_capacity_below_current_usage(
            db,
            company_id=company.id,
            values=base_values,
            when="La fecha de finalización de esta configuración personalizada",
        )
    for prior in current_overrides:
        prior.ends_at = now
        db.add(prior)

    changed_values = {
        code: value for code, value in values.items() if value != base_values[code]
    }
    for code, value in changed_values.items():
        expects_boolean = code.startswith("features.")
        db.add(
            CompanyEntitlementOverride(
                company_id=company.id,
                code=code,
                value_type="boolean" if expects_boolean else "integer",
                boolean_value=value if expects_boolean else None,
                integer_value=value if not expects_boolean else None,
                reason=update.reason,
                starts_at=now,
                ends_at=update.ends_at,
                configured_by_user_id=current_user.id,
            )
        )
    db.flush()
    db.add(
        EntitlementChangeAudit(
            company_id=company.id,
            actor_user_id=current_user.id,
            action="entitlement.customization_replaced",
            reason=update.reason,
            previous_value=previous_values,
            next_value=changed_values,
        )
    )
    user_repo.revoke_company_sessions(db, company_id=company.id)
    db.commit()
    return get_company_plan_access(db, company_id=company.id, current_user=current_user)


def _override_response(
    override: CompanyEntitlementOverride,
) -> CompanyEntitlementOverrideResponse:
    group, label, value_type = entitlement_presentation(override.code)
    return CompanyEntitlementOverrideResponse(
        id=override.id,
        code=override.code,
        label=label,
        group=group,
        value_type=value_type,
        value=override_value(override),
        reason=override.reason,
        starts_at=override.starts_at,
        ends_at=override.ends_at,
    )
