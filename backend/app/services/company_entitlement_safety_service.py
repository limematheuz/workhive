"""Safety checks for commercial changes that can reduce a company's capacity."""

from collections.abc import Mapping
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.subscription_entitlement import CompanyEntitlementOverride
from app.repositories import subscription_entitlement as entitlement_repo
from app.repositories import location_assets as location_assets_repo
from app.services.entitlement_catalog import EntitlementValue, entitlement_presentation


_USAGE_COUNTERS = {
    "limits.internal_admins": lambda db, company_id: entitlement_repo.count_active_memberships(
        db, company_id=company_id, access_class="admin"
    ),
    "limits.internal_responsibles": lambda db, company_id: entitlement_repo.count_active_memberships(
        db, company_id=company_id, access_class="responsible"
    ),
    "limits.internal_workers": lambda db, company_id: entitlement_repo.count_active_memberships(
        db, company_id=company_id, access_class="worker"
    ),
    "limits.departments": lambda db, company_id: entitlement_repo.count_active_departments(
        db, company_id=company_id
    ),
    "limits.teams": lambda db, company_id: entitlement_repo.count_active_teams(
        db, company_id=company_id
    ),
    "limits.accountant_portals": lambda db, company_id: entitlement_repo.count_active_external_access_grants(
        db, company_id=company_id, access_type="accountant", now=datetime.now(timezone.utc)
    ),
    "limits.partner_portals": lambda db, company_id: entitlement_repo.count_active_partner_portal_grants(
        db, host_company_id=company_id, now=datetime.now(timezone.utc)
    ),
    "limits.location_document_storage_bytes": location_assets_repo.active_document_bytes_for_company,
}


def override_value(override: CompanyEntitlementOverride) -> EntitlementValue:
    if override.value_type == "boolean":
        return bool(override.boolean_value)
    if override.integer_value is None:
        raise RuntimeError(f"Invalid entitlement override {override.id}")
    return int(override.integer_value)


def values_with_active_overrides(
    base_values: dict[str, EntitlementValue],
    overrides: list[CompanyEntitlementOverride],
    *,
    include_temporary: bool = True,
) -> dict[str, EntitlementValue]:
    values = dict(base_values)
    for override in overrides:
        if include_temporary or override.ends_at is None:
            values[override.code] = override_value(override)
    return values


def reject_capacity_below_current_usage(
    db: Session,
    *,
    company_id: int,
    values: Mapping[str, EntitlementValue],
    when: str = "Este cambio",
) -> None:
    """Prevent a commercial edit from leaving known company resources over quota.

    Count only implemented resources, using the same active-resource counters as
    their creation flows. Generic reserved portal capacity has no usage model.
    """

    violations: list[str] = []
    for code, count_usage in _USAGE_COUNTERS.items():
        limit = values.get(code)
        if not isinstance(limit, int) or isinstance(limit, bool):
            raise RuntimeError(f"Entitlement {code} is not an integer quota")
        usage = count_usage(db, company_id)
        if limit < usage:
            _, label, _ = entitlement_presentation(code)
            violations.append(f"{label}: {usage} en uso, límite propuesto {limit}")

    if violations:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"{when} no se puede aplicar porque reduciría una capacidad por debajo "
                f"del uso actual ({'; '.join(violations)}). Reduce primero el uso o "
                "elige un límite igual o superior."
            ),
            headers={
                "X-WorkHive-Error-Code": "entitlement.capacity_below_current_usage"
            },
        )
