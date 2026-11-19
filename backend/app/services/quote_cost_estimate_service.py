from decimal import Decimal
from fastapi import HTTPException
from app.models.quote_cost_estimate import QuoteCostEstimate
from app.models.margin_forecast import MarginForecast
from app.repositories import quote_cost_estimate as repo
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context
from app.services.quote_policy_service import require_quotes_feature


def cost(estimate):
    return ((estimate.labor_amount if estimate.labor_amount is not None else estimate.labor_hours*estimate.hourly_cost)+estimate.materials+estimate.other_costs).quantize(Decimal(".01"))


def require_quote(db,user,quote_id,manage=False):
    company=require_company_context(user)
    require_quotes_feature(db,company)
    require_capability(db,user,"finance.manage" if manage else "finance.read")
    require_capability(db,user,"labor_costs.read")
    quote=repo.quote(db,company,quote_id)
    if quote is None:raise HTTPException(404,"Presupuesto no encontrado")
    return quote


def result(quote,estimate):
    fields=("labor_hours","hourly_cost","materials","other_costs")
    current=estimate if estimate and estimate.revision==quote.revision_number else None
    revenue=Decimal(str(quote.base_amount)).quantize(Decimal(".01"))
    total=cost(current) if current else None
    return dict(revision=quote.revision_number,revenue=revenue,cost=total,labor_amount=current.labor_amount if current else None,
        margin=revenue-total if total is not None else None,
        estimate={key:getattr(current,key) for key in fields} if current else None)


def read(db,user,quote_id):
    quote=require_quote(db,user,quote_id)
    return result(quote,repo.estimate(db,quote.company_id,quote.id))


def save(db,user,quote_id,payload):
    quote=require_quote(db,user,quote_id,manage=True)
    if quote.status not in {"draft","sent"} or quote.revision_number!=payload.revision:
        raise HTTPException(409,"La revisión ha cambiado o ya está cerrada. Revisa los costes desde su contrato.")
    estimate=repo.estimate(db,quote.company_id,quote.id)
    if estimate is None:
        estimate=QuoteCostEstimate(quote_id=quote.id,company_id=quote.company_id)
        db.add(estimate)
    for key,value in payload.model_dump().items():setattr(estimate,key,value)
    estimate.labor_amount=None
    estimate.updated_by=user.id
    db.commit()
    return result(quote,estimate)


def inherit_contract_budget(db,contract,accepted_revision):
    estimate=repo.estimate(db,contract.company_id,contract.source_quote_id)
    if not estimate or estimate.revision!=accepted_revision.version or repo.contract_budget(db,contract.id):
        return
    db.add(MarginForecast(company_id=contract.company_id,service_contract_id=contract.id,
        planned_direct_cost_amount=cost(estimate),notes="Coste previsto desde la revisión aceptada del presupuesto.",
        created_by_user_id=estimate.updated_by,updated_by_user_id=estimate.updated_by))
