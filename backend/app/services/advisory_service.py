from datetime import datetime, timezone
from fastapi import HTTPException
from app.models.advisory_access import AdvisoryAccess
from app.models.external_access_grant import ExternalAccessGrant
from app.models.audit_log import AuditLog
from app.repositories import advisory as repo
from app.services.external_access_policy import is_external_portal_user
from app.services.organization_authorization_service import require_capability,has_capability
from app.services.entitlement_service import (
    company_feature_enabled,
    require_accountant_portal_capacity,
    require_company_feature,
    resolve_effective_entitlements,
)
from app.services.subscription_policy import require_company_access
from app.services.user_scope import require_company_context


def _as_utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _active_entitled_features(db, company_id):
    company = repo.company(db, company_id)
    if company is None or not company.is_active:
        return None, None
    try:
        require_company_access(company)
    except HTTPException:
        return None, None
    return company, resolve_effective_entitlements(db, company).values


def companies(db, user):
    if not is_external_portal_user(user):
        company = require_company_context(user)
        require_company_feature(db, company_id=company, code="features.accountant_portal")
        accounting=has_capability(db,user,"finance.read")
        payroll=has_capability(db,user,"labor_costs.read") and company_feature_enabled(db, company_id=company, code="features.hr")
        if not accounting and not payroll:raise HTTPException(403,"No tienes acceso a estas áreas.")
        return [{"id":company, "name":repo.company_name(db, company), "accounting":accounting, "payroll":payroll}]
    result = []
    for grant in repo.grants(db, user.id, datetime.now(timezone.utc), grant_id=getattr(user,"application_grant_id",None)).all():
        if getattr(user, "application_grant_id", grant.id) != grant.id:continue
        company_obj, features = _active_entitled_features(db, grant.company_id)
        if company_obj is None or features.get("features.accountant_portal") is not True:
            continue
        settings = repo.area(db, grant.id)
        accounting = settings.accounting if settings else True
        payroll = (settings.payroll if settings else False) and features.get("features.hr") is True
        if not accounting and not payroll:
            continue
        result.append(dict(id=grant.company_id, name=company_obj.name,
                           accounting=accounting,
                           payroll=payroll))
    return result


def require_area(db, user, company, area):
    if getattr(user, "application_company_id", company) != company:
        raise HTTPException(403, "Esta empresa no pertenece al acceso activo.")
    if not is_external_portal_user(user):
        if company != require_company_context(user):
            raise HTTPException(404, "Empresa no encontrada")
        require_capability(db, user, "finance.read" if area == "accounting" else "labor_costs.read")
    else:
        grant = repo.grants(db, user.id, datetime.now(timezone.utc), grant_id=getattr(user,"application_grant_id",None)).filter_by(company_id=company).first()
        settings = repo.area(db, grant.id) if grant else None
        enabled = getattr(settings, area) if settings else area == "accounting"
        if not grant or not enabled:
            raise HTTPException(403, "Esta área no está autorizada para tu gestoría.")
    company_obj = repo.company(db, company)
    if company_obj is None or not company_obj.is_active:
        raise HTTPException(403, "Esta empresa no está activa.")
    require_company_access(company_obj)
    require_company_feature(db, company_id=company, code="features.accountant_portal")
    if area=="payroll":require_company_feature(db,company_id=company,code="features.hr")


def list_grants(db, user):
    company = require_company_context(user)
    require_capability(db, user, "access.members.manage")
    result = []
    for grant, person in repo.company_grants(db, company):
        settings = repo.area(db, grant.id)
        result.append(dict(email=person.email, accounting=settings.accounting if settings else True,
                           payroll=settings.payroll if settings else False, can_close_periods=bool(settings and settings.can_close_periods), status=grant.status))
    return result


def save_grant(db, user, payload):
    company = require_company_context(user)
    require_capability(db, user, "access.members.manage")
    require_company_feature(db, company_id=company, code="features.accountant_portal")
    person = repo.find_user(db, payload.email)
    if not person or not is_external_portal_user(person):
        raise HTTPException(422, "Crea primero el acceso de gestoría desde Profesionales externos.")
    now = datetime.now(timezone.utc)
    next_status = "active" if payload.accounting or payload.payroll else "revoked"
    grant = repo.grant_for_user(db, company, person.id)
    was_active = bool(
        grant
        and grant.status == "active"
        and (grant.expires_at is None or _as_utc(grant.expires_at) > now)
    )
    if next_status == "active" and not was_active:
        require_accountant_portal_capacity(db, company_id=company)
    if not grant:
        grant = ExternalAccessGrant(company_id=company, user_id=person.id, access_type="accountant", granted_by_user_id=user.id)
        db.add(grant)
        db.flush()
    grant.status = next_status
    grant.revoked_at = None if next_status == "active" else now
    settings = repo.area(db, grant.id)
    if settings is None:
        settings = AdvisoryAccess(grant_id=grant.id)
        db.add(settings)
    settings.accounting, settings.payroll = payload.accounting, payload.payroll
    settings.can_close_periods = bool(payload.accounting and payload.can_close_periods)
    db.add(AuditLog(company_id=company, actor_user_id=user.id, action="advisory.areas_updated",
                    entity_type="external_access_grant", entity_id=str(grant.id),
                    details={"accounting":payload.accounting,"payroll":payload.payroll,"can_close_periods":settings.can_close_periods}))
    db.commit()
    return list_grants(db, user)


def payroll(db, user, company, month):
    require_area(db, user, company, "payroll")
    from app.services.accountant_export_service import resolve_export_period
    try:
        year, number = map(int, month.split("-"))
        period = resolve_export_period(year=year, period="month", period_number=number)
    except (ValueError, OverflowError):
        raise HTTPException(422, "Selecciona un mes válido.")
    staff, absences = repo.payroll_data(db, company, period.start.date(), period.end.date())
    variables=repo.approved_variables(db,company,period.start.date(),period.end.date())
    return dict(variables=[dict(id=v.id,employee_id=v.employee_id,kind=v.kind,amount=str(v.amount),
                              description=v.description,starts_on=v.starts_on) for v in variables],staff=[dict(id=s.id, name=s.name, position=s.position, monthly_hours=str(s.monthly_hours),
                            hourly_cost=str(s.hourly_cost), profile=s.profile, history=s.history) for s in staff],
                absences=[dict(employee_id=a.employee_id, substitute_id=a.substitute_id, starts_on=a.starts_on,
                               ends_on=a.ends_on, kind=a.kind) for a in absences])


def accounting_export(db, user, company, year):
    require_area(db, user, company, "accounting")
    from app.services.accountant_export_service import build_accountant_export, resolve_export_period
    period = resolve_export_period(year=year, period="year", period_number=None)
    return build_accountant_export(db, company_id=company, period=period)


def payroll_export(db, user, company, month):
    require_area(db, user, company, "payroll")
    from app.repositories.service_hours import tasks
    from app.services.service_hours_service import export_for_tasks
    return export_for_tasks(db, tasks(db, company, None), month)
