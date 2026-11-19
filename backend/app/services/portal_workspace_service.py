from datetime import datetime, timezone
from fastapi import HTTPException
from app.models.company_membership import CompanyMembership
from app.core.config import settings
from app.repositories import portal_workspace as repo
from app.services.organization_authorization_service import require_capability
from app.services.entitlement_service import company_feature_enabled
from app.services.user_scope import require_company_context

def utc(value):
    return value.astimezone(timezone.utc) if value is not None and value.tzinfo else value.replace(tzinfo=timezone.utc) if value else None

def effective(status, expires, user_active=True, now=None):
    if status != 'active':
        return 'revoked'
    if not user_active:
        return 'suspended'
    if expires and utc(expires) <= (now or datetime.now(timezone.utc)):
        return 'expired'
    return 'active'

def read(db, user, search='', offset=0):
    company = require_company_context(user)
    principal = require_capability(db, user, 'access.members.manage')
    if not isinstance(principal, CompanyMembership):
        raise HTTPException(403, 'Se requiere administración interna de la empresa.')
    now = datetime.now(timezone.utc)
    clients = repo.clients(db, company, search, offset)
    ids = [id for id, _ in clients[:100]]
    grants = repo.grants(db, company, ids)
    invitations = repo.invitations(db, company, ids)
    accounts = []
    for id, name in clients[:100]:
        access = [dict(id=grant.id, email=email, name=full_name, status=effective(grant.status, grant.expires_at, active, now), expires_at=utc(grant.expires_at)) for grant, email, full_name, active in grants if grant.client_id == id]
        pending = [dict(id=row.id, email=row.email, status='expired' if row.status == 'pending' and utc(row.expires_at) <= now else row.status, expires_at=utc(row.expires_at)) for row in invitations if row.client_id == id and row.status == 'pending']
        accounts.append(dict(id=id, name=name, grants=access, invitations=pending))
    advisers = []
    for grant, email, name, active, areas in repo.accountant_grants(db, company):
        advisers.append(dict(id=grant.id, email=email, name=name, status=effective(grant.status, grant.expires_at, active, now), expires_at=utc(grant.expires_at), accounting=areas.accounting if areas else True, payroll=areas.payroll if areas else False))
    return dict(clients=accounts, has_more=len(clients) > 100, advisers=advisers, summary=repo.totals(db, company, now), invitation_delivery_configured=settings.smtp_is_configured, modules=dict(client_portal=company_feature_enabled(db, company_id=company, code='features.client_portal'), advisory=company_feature_enabled(db, company_id=company, code='features.accountant_portal'), worker_app=company_feature_enabled(db, company_id=company, code='features.work_orders')), can_manage_client_invitations=user.role.name == 'admin')
