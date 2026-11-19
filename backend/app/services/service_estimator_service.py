from datetime import datetime,timedelta,timezone
from decimal import Decimal,ROUND_CEILING
from hashlib import sha256
import json
from fastapi import HTTPException
from app.repositories import service_estimator as repo,workforce_plan as workforce,inventory as inventory_repo
from app.services import location_access_service,space_workforce_policy
from app.services.organization_authorization_service import require_capability,permitted_location_ids,has_capability
from app.services.user_scope import require_company_context
from app.services.quote_policy_service import require_quotes_feature
from app.schemas.service_estimator import EstimateInput
from app.services.estimator_cost_policy import labor_lines,historical_comparison,money,ZERO,CENT


def principal(db,user,manage=False):
    company=require_company_context(user)
    require_capability(db,user,"finance.manage" if manage else "finance.read")
    require_capability(db,user,"labor_costs.read")
    require_quotes_feature(db,company)
    return company


def location(db,user,location_id):
    return location_access_service.require_location_capability(db,user,location_id,"can_manage_tasks",permission_code="work.read")


def options(db,user,location_id=None,opportunity_id=None):
    company=principal(db,user)
    if opportunity_id:require_capability(db,user,"commercial.follow_ups.read")
    opportunity=repo.opportunity(db,company,opportunity_id) if opportunity_id else None
    if opportunity_id and opportunity is None:raise HTTPException(404,"Oportunidad no encontrada")
    allowed=permitted_location_ids(db,user,"work.read")
    sites=repo.locations(db,company,allowed,opportunity.client_id if opportunity else None)
    result=dict(locations=[dict(id=site.id,name=site.name,location_type=site.location_type,client_id=site.client_id) for site in sites],
        opportunity=dict(id=opportunity.id,title=opportunity.title,client_id=opportunity.client_id) if opportunity else None,
        spaces=[],choices=dict(people=[],crews=[]),materials=[],warehouses=[],inventory_available=False)
    if location_id is None:return result
    site=location(db,user,location_id)
    if opportunity and site.client_id!=opportunity.client_id:raise HTTPException(422,"Selecciona una ubicación del cliente de la oportunidad.")
    from app.repositories.location_workspace import list_spaces
    spaces=list_spaces(db,location_id)
    result["spaces"]=[dict(id=space.id,name=space.name,space_type=space.zone_type,parent_id=space.parent_id,is_active=space.is_active,
        tasks=[dict(id=task.id,title=task.title,category=task.category,estimated_minutes=task.estimated_minutes,is_active=task.is_active) for task in space.task_templates if task.is_active]) for space in spaces]
    people=workforce.people(db,company).all();crews=workforce.crews(db,company).filter_by(is_active=True).all();members=workforce.members(db,[crew.id for crew in crews])
    result["choices"]=dict(people=[dict(id=p.id,name=p.name,position=p.position,state=(p.profile or {}).get("state","Activo")) for p in people],crews=[dict(id=crew.id,name=crew.name,employee_ids=[m.employee_id for m in members if m.crew_id==crew.id]) for crew in crews])
    if has_capability(db,user,"inventory.read"):
        result["inventory_available"]=True
        result["materials"]=[dict(id=m.id,name=m.name,unit=m.unit) for m in repo.materials(db,company)]
        result["warehouses"]=[dict(id=w.id,name=w.name) for w in repo.warehouses(db,company)]
    return result


def preview(db,user,payload):
    company=principal(db,user);site=location(db,user,payload.location_id)
    resolved=space_workforce_policy.resolve(db,company,site.id,payload.spaces,require_duration=False)
    labor,missing,labor_cost,minutes=labor_lines(resolved)
    labor_incomplete=bool(missing)
    warnings=[];material_lines=[];material_cost=ZERO;material_incomplete=False
    if payload.materials:
        require_capability(db,user,"inventory.read")
        materials={m.id:m for m in repo.materials(db,company,{row.material_id for row in payload.materials})}
        warehouses={w.id:w for w in repo.warehouses(db,company,{row.warehouse_id for row in payload.materials})}
        for selected in payload.materials:
            material=materials.get(selected.material_id);warehouse=warehouses.get(selected.warehouse_id)
            if not material or not warehouse:raise HTTPException(404,"Material o almacén no encontrado")
            available=inventory_repo.available_quantity(db,company_id=company,material_id=material.id,warehouse_id=warehouse.id)
            rate=inventory_repo.available_unit_cost(db,company_id=company,material_id=material.id,warehouse_id=warehouse.id,lot_id=None)
            if rate is None:material_incomplete=True;missing.append(f"{material.name}: no hay existencias con coste completo en {warehouse.name}.")
            amount=money(rate*selected.quantity) if rate is not None else None
            if amount is not None:material_cost+=amount
            if selected.quantity*payload.occurrences>available:warnings.append(f"{material.name}: la cantidad prevista supera las existencias actuales ({available}). Revisa la compra antes del servicio.")
            material_lines.append(dict(material_id=material.id,material=material.name,warehouse_id=warehouse.id,warehouse=warehouse.name,unit=material.unit,quantity=selected.quantity,available_quantity=available,unit_cost=rate,cost=amount))
    partial=money(labor_cost+material_cost+payload.other_costs)
    total=None if missing else partial
    price= (total/(1-payload.target_margin_percent/100)).quantize(CENT,rounding=ROUND_CEILING) if total is not None else None
    if partial*payload.occurrences>Decimal("9999999999.99") or price is not None and price*payload.occurrences>Decimal("9999999999.99") or Decimal(minutes)/60*payload.occurrences>100000:
        raise HTTPException(422,"La previsión supera el importe u horas máximos admitidos. Divide el servicio en varios presupuestos.")
    history_allowed=has_capability(db,user,"time.read",scope_type="location",scope_id=site.id)
    history=dict(available=False,sample_count=0,costed_sample_count=0,average_person_hours=None,average_labor_cost=None,note="Necesitas acceso a los fichajes de esta ubicación para consultar comparaciones históricas.")
    if history_allowed:
        recent=repo.recent_completed(db,company,site.id,datetime.now(timezone.utc)-timedelta(days=180))
        history=historical_comparison(recent,repo.sessions(db,[task.id for task in recent]),{row.space_id for row in payload.spaces},{id for row in payload.spaces for id in row.task_ids},company)
        history["available"]=True
    result=dict(location_id=site.id,location=site.name,client_id=site.client_id,labor=labor,materials=material_lines,
        labor_minutes=minutes,labor_hours=Decimal(minutes)/60,labor_cost=None if labor_incomplete else money(labor_cost),material_cost=None if material_incomplete else money(material_cost),
        known_labor_cost=money(labor_cost),known_material_cost=money(material_cost),other_costs=payload.other_costs,
        known_cost=partial,total_cost=total,suggested_unit_price=price,occurrences=payload.occurrences,
        total_price=money(price*payload.occurrences) if price is not None else None,
        total_tax=money(price*payload.occurrences*payload.tax_rate) if price is not None else None,
        target_margin_percent=payload.target_margin_percent,actual_margin_percent=money((price-total)/price*100) if price else None,
        missing=missing,warnings=warnings,can_save=not missing and site.client_id is not None,historical=history)
    if site.client_id is None or repo.client(db,company,site.client_id) is None:result["missing"].append("Vincula la ubicación a un cliente comercial activo de esta empresa antes de crear el presupuesto.");result["can_save"]=False
    fingerprint_data=dict(labor=labor,materials=material_lines,location=site.id,scope=payload.model_dump(mode="json",include=set(EstimateInput.model_fields)),price=price)
    result["fingerprint"]=sha256(json.dumps(fingerprint_data,sort_keys=True,default=str).encode()).hexdigest()
    return result
