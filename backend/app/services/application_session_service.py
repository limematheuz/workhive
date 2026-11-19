"""Select an existing authorized relationship without changing durable identity."""
from datetime import datetime, timezone
from fastapi import HTTPException
from app.core.security import create_access_token
from app.models.audit_log import AuditLog
from app.repositories import application_session as repo, company_session as company_repo
from app.services.application_session_principal import PortalUser, durable_identity
from app.services.company_session_principal import INTERNAL_ROLES, active_membership, bind
from app.services.entitlement_service import resolve_effective_entitlements
from app.services.session_token_claims import invalid_session
from app.services.subscription_policy import require_company_access


def _company_features(db, company, cache):
    if company is None or not company.is_active:
        return None
    if company.id not in cache:
        try:
            require_company_access(company)
        except HTTPException:
            cache[company.id] = None
        else:
            cache[company.id] = resolve_effective_entitlements(db, company).values
    return cache[company.id]


def _choice(kind, key_id, company, label, description, href):
    return dict(key=f"{kind}:{key_id}", kind=kind, label=label, description=description,
                company_id=company.id, company_name=company.name, href=href)


def available_applications(db, person):
    now, cache, rows = datetime.now(timezone.utc), {}, []
    if person.role and person.role.name in INTERNAL_ROLES:
        workers = repo.worker_companies(db, person.id)
        for membership, company in company_repo.contexts(db, person.id):
            if not active_membership(membership) or _company_features(db, company, cache) is None:
                continue
            rows.append(_choice("internal", company.id, company, "Administración de la empresa",
                "Gestión y operaciones según tus permisos de empresa.", "/dashboard"))
            if company.id in workers and cache[company.id].get("features.work_orders") is True:
                rows.append(_choice("worker", company.id, company, "App del trabajador",
                    "Tus trabajos, fichajes y documentación personal.", "/worker"))
    for grant in repo.client_grants(db, person.id, now):
        features = _company_features(db, grant.company, cache)
        if (features is None or features.get("features.client_portal") is not True or grant.client is None
                or not grant.client.is_active or grant.client.company_id != grant.company_id):
            continue
        rows.append(_choice("client", grant.id, grant.company, f"Portal del cliente · {grant.client.name}",
            "Servicios y documentos compartidos con este cliente.", "/portal-cliente"))
    for grant, company, area in repo.adviser_grants(db, person.id, now):
        features = _company_features(db, company, cache)
        accounting, payroll = (area.accounting, area.payroll) if area else (True, False)
        if (features is None or features.get("features.accountant_portal") is not True
                or not (accounting or payroll and features.get("features.hr") is True)):
            continue
        rows.append(_choice("adviser", grant.id, company, "Portal de gestoría",
            "Áreas contables y laborales expresamente autorizadas.", "/gestoria"))
    return rows


def options(db, person, claims):
    kind = claims.application_kind
    if kind is None:
        kind = {"client_portal": "client", "external_portal": "adviser"}.get(person.role.name, "internal")
    selected = claims.grant_id if kind in {"client", "adviser"} else claims.company_id
    return dict(current_application=kind, current_key=f"{kind}:{selected}" if selected else None,
                applications=available_applications(db, person))


def _check_work(db, person, company_id):
    work = company_repo.active_work_companies(db, person.id)
    if work and work != {company_id}:
        raise HTTPException(409, "Finaliza tu jornada abierta antes de cambiar de empresa.")


def switch(db, user, key):
    person = durable_identity(user)
    version = person.session_version
    try:
        person = company_repo.lock_identity(db, person.id)
        if person.session_version != version or not person.is_active:
            raise invalid_session()
        row = next((choice for choice in available_applications(db, person) if choice["key"] == key), None)
        if row is None:
            raise HTTPException(403, "No tienes un acceso activo a esta aplicación.")
        _check_work(db, person, row["company_id"])
        claims = dict(sub=person.email, ver=person.session_version, application_kind=row["kind"])
        if row["kind"] in {"internal", "worker"}:
            membership = company_repo.membership(db, person.id, row["company_id"])
            if not active_membership(membership):
                raise HTTPException(403, "La membresía ya no está activa.")
            claims.update(company_id=row["company_id"], membership_version=membership.session_version)
        else:
            grant_id = int(row["key"].split(":", 1)[1])
            now = datetime.now(timezone.utc)
            if row["kind"] == "client":
                grant = repo.client_grant(db, person.id, grant_id, now)
            else:
                relationship = repo.adviser_grant(db, person.id, grant_id, now)
                grant = relationship[0] if relationship is not None else None
            if grant is None:
                raise HTTPException(403, "La autorización del portal ya no está activa.")
            claims.update(application_grant_id=grant.id, application_grant_version=grant.session_version)
        token = create_access_token(claims)
        db.add(AuditLog(company_id=row["company_id"], actor_user_id=person.id, action="auth.application_changed",
            entity_type="session", entity_id=str(person.id), details={"application": row["kind"], "key": row["key"]}))
        db.commit()
        return dict(access_token=token, token_type="bearer", application=row, target_path=row["href"])
    except Exception:
        db.rollback()
        raise


def bind_portal(db, person, claims):
    now, cache = datetime.now(timezone.utc), {}
    if claims.application_kind == "client":
        grant = repo.client_grant(db, person.id, claims.grant_id, now)
        if (grant is None or grant.client is None or not grant.client.is_active
                or grant.client.company_id != grant.company_id):
            raise invalid_session()
        company, role_name = grant.company, "client_portal"
        feature = "features.client_portal"
    else:
        relationship = repo.adviser_grant(db, person.id, claims.grant_id, now)
        if relationship is None:
            raise invalid_session()
        grant, company, area = relationship
        role_name, feature = "external_portal", "features.accountant_portal"
    if grant.session_version != claims.grant_version:
        raise invalid_session()
    features = _company_features(db, company, cache)
    role = repo.role(db, role_name)
    if role is None or features is None or features.get(feature) is not True:
        raise invalid_session()
    if claims.application_kind == "adviser":
        accounting, payroll = (area.accounting, area.payroll) if area else (True, False)
        if not (accounting or payroll and features.get("features.hr") is True):
            raise invalid_session()
    return PortalUser(person, role, claims.application_kind, grant.id, company.id, grant.session_version)


def bind_internal_application(db, row, claims):
    principal = bind(row, claims.company_id, claims.version, claims.membership_version)
    if claims.application_kind is not None:
        if principal.active_membership is None or principal.role.name not in INTERNAL_ROLES:
            raise invalid_session()
        if claims.application_kind == "worker":
            features = _company_features(db, principal.company, {})
            if (claims.company_id not in repo.worker_companies(db, principal.id)
                    or features is None or features.get("features.work_orders") is not True):
                raise invalid_session()
    return principal
