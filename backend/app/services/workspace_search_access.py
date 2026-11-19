"""Resolve read capabilities once before issuing any search of business records."""
from dataclasses import dataclass, field
from fastapi import HTTPException
from app.services import client_authorization_service as clients
from app.services.entitlement_service import resolve_effective_entitlements
from app.services.organization_authorization_service import permitted_location_ids, require_capability, resolve_location_capabilities
from app.services.task_assignment_service import OPERATIONAL_VIEWER_STATUSES
from app.services.user_scope import is_superadmin, require_company_context

TYPE_ORDER = ("clients", "locations", "tasks", "invoices", "quotes", "staff", "reports", "time", "incidents")
_DENIED = object()


@dataclass
class SearchAccess:
    company_id: int
    company_name: str
    user_id: int
    allowed: set[str] = field(default_factory=set)
    location_ids: set[int] | None = field(default_factory=set)
    task_locations: set[int] | None = field(default_factory=set)
    task_requested_locations: set[int] | None = field(default_factory=set)
    task_own_user: int | None = None
    task_viewer_statuses: tuple[str, ...] = ()
    report_assigned_user: int | None = None
    time_locations: set[int] | None = field(default_factory=set)
    incident_locations: set[int] | None = field(default_factory=set)
    navigation_types: set[str] = field(default_factory=set)


def permitted(operation):
    try:
        return operation()
    except HTTPException as error:
        if error.status_code not in (403, 404):
            raise
        return _DENIED


def access_plan(db, user):
    if is_superadmin(user) or not user.role or user.role.name not in {"admin", "manager", "viewer"} or user.company_id is None:
        raise HTTPException(403, "La búsqueda requiere un acceso interno con empresa activa.")
    company = require_company_context(user)
    features = resolve_effective_entitlements(db, user.company).values
    plan = SearchAccess(company, user.company.name, user.id)
    if features.get("features.clients") is True and permitted(lambda: clients.require_client_capability(db, user, "clients.read")) is not _DENIED:
        plan.allowed.add("clients")
    if features.get("features.locations") is True:
        ids = permitted(lambda: permitted_location_ids(db, user, "locations.read"))
        if ids is not _DENIED:
            plan.location_ids = ids
            plan.allowed.add("locations")
    if features.get("features.work_orders") is True:
        scopes = permitted(lambda: resolve_location_capabilities(db, user, read_capability="work.read", manage_capability="work.manage"))
        if scopes is not _DENIED:
            plan.task_locations, plan.task_requested_locations, legacy = scopes
            plan.allowed.update(("tasks", "reports"))
            if legacy and user.role.name == "viewer":
                plan.task_own_user = user.id
                plan.task_viewer_statuses = tuple(OPERATIONAL_VIEWER_STATUSES)
            if user.role.name == "viewer":
                plan.report_assigned_user = user.id
    if permitted(lambda: require_capability(db, user, "finance.read", scope_type="company")) is not _DENIED:
        for kind, feature in (("invoices", "features.invoices"), ("quotes", "features.quotes")):
            if features.get(feature) is True:
                plan.allowed.add(kind)
    if features.get("features.hr") is True and permitted(lambda: require_capability(db, user, "labor_costs.read", scope_type="company")) is not _DENIED:
        plan.allowed.add("staff")
    if features.get("features.time_tracking") is True:
        ids = permitted(lambda: permitted_location_ids(db, user, "time.manage"))
        if ids is not _DENIED:
            plan.time_locations = ids
            plan.allowed.add("time")
    if features.get("features.quality") is True:
        ids = permitted(lambda: permitted_location_ids(db, user, "quality.incidents.read"))
        if ids is not _DENIED:
            plan.incident_locations = ids
            plan.allowed.add("incidents")
        if permitted(lambda: permitted_location_ids(db, user, "quality.inspections.read")) is not _DENIED:
            plan.navigation_types.add("inspections")
    return plan
