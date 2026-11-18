"""History uses each record's canonical read boundary; external portals are separate."""
from fastapi import HTTPException
from app.core.datetime import as_utc
from app.models.company_membership import CompanyMembership
from app.repositories import record_history as repo, organization as organization_repo
from app.services import client_authorization_service, client_service, location_access_service, quote_service, service_contract_service, work_order_service, task_item_read_service
from app.services.organization_authorization_service import require_capability, has_capability, uses_legacy_role_authorization
from app.services.entitlement_service import require_company_feature
from app.services.user_scope import require_company_context
from app.services.record_history_catalog import LABELS, FINANCIAL_FIELDS, LABOR_FIELDS


def internal_capability(db, user, permission, **scope):
    principal = require_capability(db, user, permission, **scope)
    if not isinstance(principal, CompanyMembership):
        raise HTTPException(403, "El historial interno requiere una membresía de empresa.")
    return principal


def authorize(db, user, entity_type, identifier):
    if not user.role or user.role.name in {"superadmin", "external_portal", "client_portal", "partner_portal"}:
        raise HTTPException(403, "Este historial está reservado al equipo interno autorizado.")
    company = require_company_context(user)
    location_id = None
    if entity_type == "client":
        client_authorization_service.require_client_membership(db, user, "clients.read")
        require_company_feature(db, company_id=company, code="features.clients")
        client_service.get_client(db, company, identifier)
    elif entity_type == "staff_employee":
        internal_capability(db, user, "labor_costs.read", scope_type="company")
        require_company_feature(db, company_id=company, code="features.hr")
        if repo.employee(db, company, identifier) is None:
            raise HTTPException(404, "Trabajador no encontrado")
    elif entity_type in {"quote", "service_contract"}:
        internal_capability(db, user, "finance.read", scope_type="company")
        if entity_type == "quote":
            quote_service.get_quote(db, company, identifier)
        else:
            service_contract_service.get_contract(db, company, identifier)
    elif entity_type in {"invoice", "expense"}:
        internal_capability(db, user, "finance.read", scope_type="company")
        from app.services import invoice_service, expense_service
        if entity_type == "invoice":
            invoice_service.get_invoice(db, company, identifier)
        else:
            expense_service.get_expense(db, company, identifier)
    elif entity_type in {"company_membership", "permission_profile"}:
        permission = "access.members.read" if entity_type == "company_membership" else "access.profiles.read"
        internal_capability(db, user, permission, scope_type="company")
        require_company_feature(db, company_id=company, code="features.organization")
        record = organization_repo.get_company_membership(db, company_id=company, membership_id=identifier) if entity_type == "company_membership" else organization_repo.get_permission_profile(db, company_id=company, profile_id=identifier)
        if record is None:
            raise HTTPException(404, "Ficha de acceso no encontrada")
    elif entity_type == "location":
        location_access_service.require_readable_location(db, user, identifier)
        internal_capability(db, user, "locations.read", scope_type="location", scope_id=identifier)
        require_company_feature(db, company_id=company, code="features.locations")
        location_id = identifier
    elif entity_type == "work_order":
        order = work_order_service.get_work_order(db, user, identifier)
        location_id = order.location_id
        internal_capability(db, user, "work.read", scope_type="location", scope_id=location_id)
    elif entity_type == "task_item":
        task = task_item_read_service.get_task_item(db, user, identifier)
        location_id = task.location_id
        internal_capability(db, user, "work.read", scope_type="location", scope_id=location_id)
        if uses_legacy_role_authorization(db, user, "work.read") and user.role.name == "viewer":
            from app.services import task_assignment_service
            if not task_assignment_service.can_viewer_access_task(task, user.id) or task.status not in task_assignment_service.OPERATIONAL_VIEWER_STATUSES:
                raise HTTPException(404, "Trabajo no encontrado")
    else:
        raise HTTPException(422, "Tipo de ficha no admitido")
    finance_scope = dict(scope_type="location", scope_id=location_id) if location_id is not None else dict(scope_type="company")
    return company, has_capability(db, user, "finance.read", **finance_scope), has_capability(db, user, "labor_costs.read", scope_type="company")


def text(value, maximum=240):
    if value is None:
        return None
    if isinstance(value, bool):
        return "Sí" if value else "No"
    return str(value)[:maximum] if isinstance(value, (str, int, float)) else None


def serialize(row, actor, finance, labor):
    details = row.details if isinstance(row.details, dict) else {}
    allowed = set(LABELS)
    if not finance:
        allowed -= FINANCIAL_FIELDS
    if not labor:
        allowed -= LABOR_FIELDS
    changes = []
    seen = set()
    for change in details.get("changes", []) if isinstance(details.get("changes"), list) else []:
        if not isinstance(change, dict) or not isinstance(change.get("field"), str) or change["field"] not in allowed:
            continue
        field = change["field"]
        seen.add(field)
        maximum = 6000 if field in {"permission_codes", "profile_assignments", "workforce_scope"} else 240
        changes.append(dict(field=field, label=LABELS[field], before=text(change.get("before"), maximum), after=text(change.get("after"), maximum), before_known=change.get("before_known") is True))
    fields = [LABELS[field] for field in details.get("fields", []) if isinstance(field, str) and field in allowed] if isinstance(details.get("fields"), list) else []
    for field, value in details.items():
        if field in allowed and field not in seen and (value is None or isinstance(value, (str, int, float, bool))):
            fields.append(LABELS[field])
    action = {"record.created":"Ficha creada", "record.updated":"Datos modificados", "record.deleted":"Ficha eliminada"}.get(row.action, row.action)
    return dict(id=row.id, occurred_at=as_utc(row.created_at), actor_name=actor or "Cuenta no disponible", action=action,
        changes=changes, fields=list(dict.fromkeys(fields)))


def read(db, user, entity_type, identifier, offset):
    company, finance, labor = authorize(db, user, entity_type, identifier)
    rows = repo.events(db, company, entity_type, identifier, offset)
    return dict(items=[serialize(row, actor, finance, labor) for row, actor in rows[:50]], has_more=len(rows)>50)
