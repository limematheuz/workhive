"""Apply platform-only plan changes after entitlement capacity checks."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.user import User
from app.repositories import subscription_entitlement as entitlement_repo
from app.repositories import user as user_repo
from app.schemas.company_entitlement_management import CompanyPlanAccessUpdate
from app.services import company_entitlement_service
from app.services.company_entitlement_safety_service import (
    reject_capacity_below_current_usage,
    values_with_active_overrides,
)
from app.services.entitlement_management_support import (
    entitlement_value_from_row,
    utcnow,
)
from app.services.user_scope import require_platform_superadmin


def _lock_company(db: Session, *, company_id: int) -> Company:
    company = entitlement_repo.lock_company(db, company_id=company_id)
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se ha encontrado la empresa solicitada",
        )
    return company


def update_company_plan_access(
    db: Session,
    *,
    company_id: int,
    update: CompanyPlanAccessUpdate,
    current_user: User,
) -> int:
    """Persist a plan mutation and return the company for its fresh response."""
    require_platform_superadmin(current_user)
    company = _lock_company(db, company_id=company_id)
    now = utcnow()
    if update.status == "trialing" and update.trial_ends_at <= now:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La fecha de finalización de la prueba debe ser futura",
        )
    if update.commercial_terms and update.commercial_terms.effective_at > now:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La fecha efectiva de las condiciones comerciales no puede ser futura",
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
        commercial_terms=(
            company_entitlement_service.CommercialSubscriptionTerms(
                billing_interval=update.commercial_terms.billing_interval,
                amount_cents=update.commercial_terms.amount_cents,
                currency=update.commercial_terms.currency,
                tax_behavior=update.commercial_terms.tax_behavior,
                effective_at=update.commercial_terms.effective_at,
            )
            if update.commercial_terms is not None
            else None
        ),
    )
    user_repo.revoke_company_sessions(db, company_id=company.id)
    db.commit()
    return company.id
