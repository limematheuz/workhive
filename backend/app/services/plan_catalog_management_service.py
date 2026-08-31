"""Platform management of versioned standard plans."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.subscription_entitlement import (
    PlanCatalogAudit,
    PlanEntitlement,
    PlanPrice,
    SubscriptionPlan,
)
from app.models.user import User
from app.repositories import subscription_entitlement as entitlement_repo
from app.schemas.company_entitlement_management import (
    PlanCatalogResponse,
    PlanCatalogUpdate,
)
from app.services.entitlement_catalog import plan_label
from app.services.entitlement_management_support import (
    entitlement_value_from_row,
    plan_response,
    validate_entitlement_values,
)
from app.services.user_scope import require_platform_superadmin


def list_plan_catalog(db: Session, current_user: User) -> list[PlanCatalogResponse]:
    require_platform_superadmin(current_user)
    return [plan_response(plan) for plan in entitlement_repo.list_active_plans(db)]


def update_standard_plan(
    db: Session,
    *,
    plan_code: str,
    update: PlanCatalogUpdate,
    current_user: User,
) -> PlanCatalogResponse:
    require_platform_superadmin(current_user)
    if plan_code not in {"basic", "medium", "top", "mega"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Only standard plans can be edited",
        )
    try:
        values = validate_entitlement_values(update.entitlements)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error

    current = entitlement_repo.get_active_plan(db, code=plan_code)
    if current is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The plan catalogue is not installed",
        )
    current_values = {
        item.code: entitlement_value_from_row(item) for item in current.entitlements
    }
    if current_values == values:
        return plan_response(current)

    entitlement_repo.deactivate_active_plan_versions(db, code=plan_code)
    next_plan = SubscriptionPlan(
        code=plan_code,
        name=plan_label(plan_code),
        version=entitlement_repo.get_next_plan_version(db, code=plan_code),
        is_active=True,
    )
    db.add(next_plan)
    db.flush()
    for code, value in values.items():
        db.add(
            PlanEntitlement(
                plan_id=next_plan.id,
                code=code,
                value_type="boolean" if isinstance(value, bool) else "integer",
                boolean_value=value if isinstance(value, bool) else None,
                integer_value=(
                    value if isinstance(value, int) and not isinstance(value, bool) else None
                ),
            )
        )
    for price in current.prices:
        db.add(
            PlanPrice(
                plan_id=next_plan.id,
                billing_interval=price.billing_interval,
                amount_cents=price.amount_cents,
                currency=price.currency,
                tax_behavior=price.tax_behavior,
            )
        )
    db.add(
        PlanCatalogAudit(
            plan_id=next_plan.id,
            plan_code=plan_code,
            plan_version=next_plan.version,
            actor_user_id=current_user.id,
            reason=update.reason,
            previous_value=current_values,
            next_value=values,
        )
    )
    db.commit()
    db.refresh(next_plan)
    return plan_response(next_plan)
