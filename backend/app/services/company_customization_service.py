"""Apply contractual, company-specific entitlement customizations."""

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
    CompanyEntitlementCustomizationUpdate,
)
from app.schemas.subscription_terms import CommercialSubscriptionTermsInput
from app.services import company_entitlement_service
from app.services.company_entitlement_safety_service import (
    override_value,
    reject_capacity_below_current_usage,
)
from app.services.entitlement_management_support import (
    current_plan_values,
    utcnow,
    validate_entitlement_values,
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


def _commercial_terms_from_input(
    terms: CommercialSubscriptionTermsInput,
) -> company_entitlement_service.CommercialSubscriptionTerms:
    return company_entitlement_service.CommercialSubscriptionTerms(
        billing_interval=terms.billing_interval,
        amount_cents=terms.amount_cents,
        currency=terms.currency,
        tax_behavior=terms.tax_behavior,
        effective_at=terms.effective_at,
    )


def require_active_customization_contract(
    db: Session,
    *,
    company: Company,
    commercial_terms: CommercialSubscriptionTermsInput | None = None,
):
    """Return newly supplied terms, or reject an uncontracted customization.

    Custom access is a negotiated extension of an active standard subscription,
    never a self-service plan or a way to broaden a trial.  Historical active
    rows may lack a price snapshot; the first customization must register one.
    """
    if company.subscription_status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Las ampliaciones personalizadas requieren una suscripción activa",
        )
    now = utcnow()
    if commercial_terms is not None:
        if commercial_terms.effective_at > now:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="La fecha efectiva de las condiciones comerciales no puede ser futura",
            )
        return _commercial_terms_from_input(commercial_terms)

    subscription = entitlement_repo.get_latest_company_subscription(
        db, company_id=company.id
    )
    if company_entitlement_service.subscription_commercial_terms(subscription) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "Registra las condiciones comerciales antes de aplicar una "
                "ampliación personalizada"
            ),
        )
    return None


def replace_company_entitlement_customization(
    db: Session,
    *,
    company_id: int,
    update: CompanyEntitlementCustomizationUpdate,
    current_user: User,
) -> int:
    """Replace the contractual exceptions in one audited transaction."""
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
    commercial_terms = require_active_customization_contract(
        db,
        company=company,
        commercial_terms=update.commercial_terms,
    )
    base_values, _ = current_plan_values(db, company)
    current_overrides = entitlement_repo.list_active_overrides(
        db, company_id=company.id, now=now
    )
    previous_values = {item.code: override_value(item) for item in current_overrides}
    reject_capacity_below_current_usage(db, company_id=company.id, values=values)
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
    company_entitlement_service.synchronize_company_subscription(
        db,
        company,
        reason=update.reason,
        actor_user_id=current_user.id,
        now=now,
        audit_action="subscription.customization_terms_changed",
        commercial_terms=commercial_terms,
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
    return company.id
