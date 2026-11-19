from decimal import Decimal,InvalidOperation
from fastapi import HTTPException
from app.models.quote_cost_estimate import QuoteCostEstimate
from app.models.workforce_plan import QuoteWorkScope
from app.schemas.quote import QuoteCreate
from app.schemas.quote_item import QuoteItemCreate
from app.repositories import service_estimator as repo
from app.services import quote_service
from app.services.organization_authorization_service import require_capability
from app.services import service_estimator_service as estimator
from app.services.estimator_cost_policy import money,ZERO


def create(db,user,payload):
    company=estimator.principal(db,user,manage=True)
    result=estimator.preview(db,user,payload)
    if not result["can_save"]:raise HTTPException(422,"Completa las fuentes pendientes antes de crear el presupuesto.")
    if result["fingerprint"]!=payload.expected_fingerprint:raise HTTPException(409,"Los costes registrados han cambiado. Vuelve a calcular y revisa el precio.")
    if payload.opportunity_id:require_capability(db,user,"commercial.follow_ups.read")
    opportunity=repo.opportunity(db,company,payload.opportunity_id) if payload.opportunity_id else None
    if payload.opportunity_id and (opportunity is None or opportunity.client_id!=result["client_id"]):raise HTTPException(404,"Oportunidad no encontrada para este cliente.")
    spaces=[row.model_dump(mode="json") for row in payload.spaces]
    description="Limpieza por espacios · "+", ".join(dict.fromkeys(line["space"] for line in result["labor"]))
    description=description[:1000]
    unit_price=result["suggested_unit_price"]
    try:
        quote=quote_service.create_quote(db,company,QuoteCreate(client_id=result["client_id"],title=payload.title,
            tax_rate=float(payload.tax_rate),notes="Previsión elaborada con los costes de personal, tareas y materiales registrados. Importes internos sin impuestos.",
            items=[QuoteItemCreate(description=description,quantity=payload.occurrences,unit_price=float(unit_price))]),commit=False)
        hours=result["labor_hours"]*payload.occurrences
        amount=result["labor_cost"]*payload.occurrences
        weighted=amount/hours if hours else ZERO
        db.add(QuoteCostEstimate(quote_id=quote.id,company_id=company,revision=quote.revision_number,
            labor_amount=money(amount),labor_hours=money(hours),hourly_cost=money(weighted),
            materials=money(result["material_cost"]*payload.occurrences),other_costs=money(payload.other_costs*payload.occurrences),updated_by=user.id))
        configuration=dict(schema_version=1,quote_revision=quote.revision_number,spaces=spaces,occurrences=payload.occurrences,
            quoted_unit_price=str(unit_price),quote_line_description=description,labor_cost_per_occurrence=str(result["labor_cost"]),
            labor_hours_exact=str(result["labor_hours"]),material_cost_per_occurrence=str(result["material_cost"]),
            other_cost_per_occurrence=str(payload.other_costs),total_cost_per_occurrence=str(result["total_cost"]),
            target_margin_percent=str(payload.target_margin_percent),materials=[{key:str(value) if isinstance(value,Decimal) else value for key,value in row.items()} for row in result["materials"]],
            source_summary=dict(labor=[{key:str(value) if isinstance(value,Decimal) else value for key,value in row.items()} for row in result["labor"]],fingerprint=result["fingerprint"]))
        db.add(QuoteWorkScope(quote_id=quote.id,company_id=company,location_id=payload.location_id,configuration=configuration,opportunity_id=payload.opportunity_id))
        db.commit()
    except Exception:
        db.rollback();raise
    return dict(quote_id=quote.id,quote_number=quote.quote_number,total_amount=quote.total_amount,cost=money(result["total_cost"]*payload.occurrences))


def _subject(spaces):
    return sorted((int(row["space_id"]),tuple(sorted(int(id) for id in row.get("task_ids",[])))) for row in (item.model_dump() if hasattr(item,"model_dump") else item for item in spaces))


def pricing_for_order(db,order,spaces):
    contract=order.service_contract
    if contract is None or contract.status!="active" or contract.company_id!=order.company_id:return {}
    scope=repo.quote_scope(db,order.company_id,contract.source_quote_id)
    if scope is None or scope.location_id!=order.location_id:return {}
    revision=repo.revision(db,contract.source_quote_revision_id)
    config=scope.configuration or {}
    if config.get("schema_version")!=1 or revision is None or revision.accepted_at is None or revision.quote_id!=scope.quote_id or revision.version!=config.get("quote_revision"):return {}
    try:
        if _subject(spaces)!=_subject(config.get("spaces",[])):return {}
        snapshot=revision.snapshot or {};items=snapshot.get("items",[])
        if len(items)!=1:return {}
        unit=Decimal(str(config.get("quoted_unit_price","0")));occurrences=Decimal(str(config.get("occurrences","0")))
        if unit<=0 or occurrences<=0:return {}
        item=items[0]
        if Decimal(str(item.get("unit_price",-1)))!=unit or Decimal(str(item.get("quantity",-1)))!=occurrences:return {}
        if item.get("description")!=config.get("quote_line_description"):return {}
        if money(Decimal(str(snapshot.get("base_amount",-1))))!=money(unit*occurrences):return {}
        return dict(price=float(unit),quantity=1,unit="service",pricing_mode="fixed")
    except (InvalidOperation,KeyError,TypeError,ValueError):return {}
