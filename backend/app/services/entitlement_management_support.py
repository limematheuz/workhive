"""Shared value conversion and validation for commercial entitlement management."""

from datetime import datetime, timezone

from app.models.company import Company
from app.models.subscription_entitlement import PlanEntitlement, SubscriptionPlan
from app.repositories import subscription_entitlement as entitlement_repo
from app.schemas.company_entitlement_management import (
    EntitlementResponse,
    EntitlementValueUpdate,
    PlanCatalogResponse,
)
from app.services.entitlement_catalog import (
    ALL_ENTITLEMENT_CODES,
    EntitlementValue,
    default_plan_values,
    entitlement_availability,
    entitlement_presentation,
    legacy_plan_code,
    plan_label,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def entitlement_response(
    code: str, value: EntitlementValue, *, source: str
) -> EntitlementResponse:
    group, label, value_type = entitlement_presentation(code)
    return EntitlementResponse(
        code=code,
        label=label,
        group=group,
        value_type=value_type,
        value=value,
        source=source,
        availability=entitlement_availability(code),
    )


def entitlement_value_from_row(item: PlanEntitlement) -> EntitlementValue:
    if item.value_type == "boolean":
        return bool(item.boolean_value)
    if item.integer_value is None:
        raise RuntimeError(f"Invalid plan entitlement {item.id}")
    return int(item.integer_value)


def plan_response(plan: SubscriptionPlan) -> PlanCatalogResponse:
    return PlanCatalogResponse(
        code=plan.code,
        label=plan_label(plan.code),
        version=plan.version,
        entitlements=[
            entitlement_response(
                item.code,
                entitlement_value_from_row(item),
                source="plan",
            )
            for item in sorted(plan.entitlements, key=lambda item: item.code)
        ],
    )


def validate_entitlement_values(
    entries: list[EntitlementValueUpdate],
) -> dict[str, EntitlementValue]:
    values: dict[str, EntitlementValue] = {}
    for entry in entries:
        if entry.code not in ALL_ENTITLEMENT_CODES:
            raise ValueError(f"Unknown entitlement code: {entry.code}")
        expects_boolean = entry.code.startswith("features.")
        value: EntitlementValue = (
            entry.boolean_value
            if entry.boolean_value is not None
            else int(entry.integer_value or 0)
        )
        if expects_boolean != isinstance(value, bool):
            expected = "boolean" if expects_boolean else "integer"
            raise ValueError(f"Entitlement {entry.code} requires a {expected} value")
        if entry.code in values:
            raise ValueError(f"Entitlement {entry.code} was supplied more than once")
        values[entry.code] = value
    if set(values) != ALL_ENTITLEMENT_CODES:
        missing = sorted(ALL_ENTITLEMENT_CODES - set(values))
        raise ValueError(f"Every entitlement must be supplied; missing: {', '.join(missing)}")
    return values


def current_plan_values(
    db, company: Company
) -> tuple[dict[str, EntitlementValue], int | None]:
    subscription = entitlement_repo.get_latest_company_subscription(
        db, company_id=company.id
    )
    if subscription and subscription.plan:
        return (
            {
                item.code: entitlement_value_from_row(item)
                for item in subscription.plan.entitlements
            },
            subscription.plan.version,
        )
    return default_plan_values(legacy_plan_code(company.subscription_plan)), None
