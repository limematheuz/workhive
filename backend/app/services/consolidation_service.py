from decimal import Decimal,ROUND_HALF_UP
from fastapi import HTTPException
from app.models.company_membership import CompanyMembership
from app.repositories import consolidation as repo
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context
from app.services.client_profitability_service import get_client_profitability
from app.services.entitlement_service import require_company_feature
from app.repositories import company_session as session_repo
from app.services.company_session_principal import bind,identity,CompanyUser


def company_principal(db,user,company):
    person=identity(user)
    principal=bind(session_repo.authenticate(db,person.email,company),company,person.session_version)
    if not isinstance(principal,CompanyUser) or principal.active_membership is None or principal.id!=person.id or not principal.company.is_active:
        raise HTTPException(403,"Necesitas una membresía activa en la sociedad seleccionada.")
    return principal


def require_access(db, user):
    principal = require_capability(db, user, "finance.read", scope_type="company")
    if not isinstance(principal, CompanyMembership):
        raise HTTPException(403, "La consolidación requiere una membresía interna de empresa.")
    company = require_company_context(user)
    require_company_feature(db, company_id=company, code="features.corporate_structure")
    return company


def can_consult(db, user, company):
    try:
        require_access(db, company_principal(db,user, company))
    except HTTPException as error:
        if error.status_code in {403, 404}:
            return False
        raise
    return True


def companies(db,user):
    current = require_access(db, user)
    authorized=[c for c in repo.companies(db,user) if c.id == current or can_consult(db, user, c.id)]
    authorized_ids = {company.id for company in authorized}
    preferences,parents=repo.metadata(db,[c.id for c in authorized])
    return [dict(id=c.id,name=c.name,country=preferences[c.id].country if c.id in preferences else "ES",parent_company_id=parents.get(c.id) if parents.get(c.id) in authorized_ids else None) for c in authorized]


def report(db,user,payload):
    authorized = {c["id"]:c["name"] for c in companies(db,user)}
    if not set(payload.companies)<=authorized.keys():
        raise HTTPException(403,"Selecciona únicamente sociedades que puedas consultar.")
    if payload.currency=="EUR" and payload.eur_rate!=1:
        raise HTTPException(422,"El tipo de cambio para EUR debe ser 1.")
    rows=[]
    for company_id in sorted(set(payload.companies)):
        summary=get_client_profitability(db,company_id,period=payload.period,reference_date=payload.reference_date).current
        revenue=summary.revenue_base_amount+summary.unlinked_historical_sales_base_amount
        costs=summary.direct_cost_base_amount+summary.unassigned_expense_base_amount+summary.unassigned_material_cost_base_amount
        convert=lambda value:(value*payload.eur_rate).quantize(Decimal(".01"),rounding=ROUND_HALF_UP)
        rows.append(dict(company_id=company_id,name=authorized[company_id],revenue=convert(revenue),cost=convert(costs),margin=convert(revenue-costs)))
    return dict(currency=payload.currency,eur_rate=payload.eur_rate,period=payload.period,reference_date=payload.reference_date,
                companies=rows,revenue=sum(r["revenue"] for r in rows),cost=sum(r["cost"] for r in rows),margin=sum(r["margin"] for r in rows))
