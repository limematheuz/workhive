"""Search authorized scalar projections, with recognizable names and destinations."""
from hashlib import sha256
from fastapi import HTTPException
from app.repositories import workspace_search_operations as operations, workspace_search_records as records
from app.repositories import staff as staff_repo
from app.repositories.workspace_search_text import normalize
from app.services.workspace_search_access import TYPE_ORDER, access_plan
from app.services.organization_authorization_service import require_capability
from app.services.entitlement_service import require_company_feature
from app.services.user_scope import require_company_context

LABELS = {"clients":"Clientes", "locations":"Ubicaciones", "tasks":"Trabajos", "invoices":"Facturas",
    "quotes":"Presupuestos", "staff":"Trabajadores", "reports":"Partes de trabajo", "time":"Mis fichajes", "incidents":"Incidencias de calidad"}
READERS = {"clients":records.clients, "locations":records.locations, "tasks":operations.tasks,
    "invoices":records.invoices, "quotes":records.quotes, "staff":records.staff, "reports":operations.reports, "time":operations.time,
    "incidents":operations.incidents}
HREFS = {"clients":"/dashboard/clients?clientId={id}", "locations":"/dashboard/locations?locationId={id}",
    "tasks":"/dashboard?taskId={id}", "invoices":"/dashboard/invoices/{id}", "quotes":"/dashboard/quotes/{id}",
    "staff":"/dashboard/plantilla/trabajadores?employeeId={id}", "reports":"/dashboard/task-reports?reportId={id}",
    "time":"/worker/clock?sessionId={id}", "incidents":"/dashboard/quality?tab=incidents&incidentId={id}"}
DESTINATIONS = (
    ("time", "Mi fichaje y jornada", "Fichar y consultar tus registros propios.", "/worker/clock", ("jornada", "fichaje", "fichar", "horas")),
    ("reports", "Partes de trabajo", "Consultar los partes autorizados de tus trabajos.", "/dashboard/task-reports", ("parte", "reporte")),
    ("incidents", "Incidencias y calidad", "Consultar las incidencias de tus ubicaciones autorizadas.", "/dashboard/quality?tab=incidents", ("incidencia", "calidad")),
    ("inspections", "Inspecciones de calidad", "Consultar las inspecciones de tus ubicaciones autorizadas.", "/dashboard/quality?tab=inspections", ("inspeccion", "calidad")),
    ("tasks", "Trabajos", "Buscar servicios y seguir su avance.", "/dashboard/tasks", ("trabajo", "servicio", "tarea")),
    ("clients", "Clientes", "Consultar tus clientes autorizados.", "/dashboard/clients", ("cliente",)),
    ("locations", "Ubicaciones", "Centros y espacios de tu empresa.", "/dashboard/locations", ("ubicacion", "centro", "espacio")),
    ("invoices", "Facturas", "Consultar tus documentos de facturación.", "/dashboard/invoices", ("factura", "facturacion", "cobro")),
    ("quotes", "Presupuestos", "Consultar propuestas comerciales autorizadas.", "/dashboard/quotes", ("presupuesto", "propuesta")),
    ("staff", "Trabajadores", "Consultar la plantilla autorizada.", "/dashboard/plantilla/trabajadores", ("trabajador", "personal", "plantilla")),
)


def _navigation(plan, term):
    return [dict(key="navigation:" + kind, type="navigation", id=None, title=title, context=description,
        status=None, reference=None, href=href, occurred_at=None)
        for kind, title, description, href, words in DESTINATIONS
        if kind in plan.allowed | plan.navigation_types and any(word.startswith(term) or term in word for word in words)]


def search(db, user, query, types=None, limit=5):
    text = " ".join(query.split())
    if not 2 <= len(text) <= 120:
        raise HTTPException(422, "Escribe entre 2 y 120 caracteres para buscar.")
    term = normalize(text)
    plan = access_plan(db, user)
    requested = set(types) if types is not None else set(TYPE_ORDER)
    groups = []
    for kind in TYPE_ORDER:
        if kind not in plan.allowed or kind not in requested:
            continue
        hits = READERS[kind](db, plan, term, limit)
        items = [dict(key=f"{kind}:{hit.id}", type=kind, id=hit.id, title=hit.title, context=hit.context,
            status=hit.status, reference=hit.reference, href=HREFS[kind].format(id=hit.id), occurred_at=hit.occurred_at)
            for hit in hits[:limit]]
        groups.append(dict(type=kind, label=LABELS[kind], items=items, has_more=len(hits) > limit))
    identity = f"{user.id}:{plan.company_id}:{user.role.name}:{user.session_version}:{getattr(user,'membership_session_version',0)}"
    return dict(query=text, company_id=plan.company_id, context_key=sha256(identity.encode()).hexdigest()[:24],
        available_types=[kind for kind in TYPE_ORDER if kind in plan.allowed], groups=groups, navigation=_navigation(plan, term))


def staff_detail(db, user, employee_id):
    company = require_company_context(user)
    require_capability(db, user, "labor_costs.read", scope_type="company")
    require_company_feature(db, company_id=company, code="features.hr")
    employee = staff_repo.employee(db, company, employee_id)
    if employee is None:
        raise HTTPException(404, "Trabajador no encontrado.")
    return employee
