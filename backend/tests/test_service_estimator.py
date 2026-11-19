from copy import deepcopy
from datetime import datetime
from decimal import Decimal
from app.models.staff_employee import StaffEmployee
from app.models.workforce_plan import QuoteWorkScope
from app.models.quote_cost_estimate import QuoteCostEstimate
from app.models.margin_forecast import MarginForecast
from app.models.work_order import WorkOrder
from app.models.inventory import InventoryMaterial,InventoryWarehouse,InventoryMovement
from app.models.client_opportunity import ClientOpportunity
from app.services.estimator_quote_service import pricing_for_order
from tests.test_client_permission_authorization import _company,_bootstrap_admin,_headers,_user
from test_service_contracts import _client,_location


def setup(client,db,suffix="estimator",minutes=1,rate=15):
    company=_company(db,suffix);admin=_bootstrap_admin(db,company,suffix);headers=_headers(admin)
    customer=_client(client,headers)
    site=_location(client,headers,customer["id"],spaces=[{"name":"Planta 1","space_type":"office","tasks":[{"title":"Mesas","estimated_minutes":minutes}]},{"name":"Planta 2","space_type":"office","tasks":[{"title":"Suelo","estimated_minutes":45}]}])
    spaces=client.get(f"/api/v1/locations/{site['id']}/spaces",headers=headers).json()
    person=StaffEmployee(company_id=company.id,name="Persona real",position="Limpieza",team="",monthly_hours=160,hourly_cost=rate)
    db.add(person);db.commit()
    payload={"location_id":site["id"],"spaces":[{"space_id":spaces[0]["id"],"task_ids":[spaces[0]["tasks"][0]["id"]],"employee_ids":[person.id]}],"target_margin_percent":"20","occurrences":1,"tax_rate":"0.21","other_costs":"0"}
    return company,admin,headers,customer,site,spaces,person,payload


def preview(client,headers,body):
    response=client.post("/api/v1/service-estimator/preview",headers=headers,json=body)
    assert response.status_code==200,response.text
    return response.json()


def create(client,headers,body,calculation,**extra):
    return client.post("/api/v1/service-estimator/quotes",headers=headers,json={**body,"title":"Limpieza parcial","expected_fingerprint":calculation["fingerprint"],**extra})


def test_minute_cost_is_exact_in_draft_accepted_budget_and_matching_service(client,db):
    company,_,headers,_,site,_,person,body=setup(client,db)
    result=preview(client,headers,body)
    assert Decimal(result["labor_cost"])==Decimal(".25")
    assert Decimal(result["suggested_unit_price"])==Decimal(".32")
    assert result["historical"]["sample_count"]==0 and result["historical"]["average_labor_cost"] is None
    assert create(client,headers,body,result,title="  ").status_code==422
    created=create(client,headers,body,result)
    assert created.status_code==201,created.text
    quote=created.json();estimate=db.get(QuoteCostEstimate,quote["quote_id"])
    assert estimate.labor_amount==Decimal(".25")
    costs=client.get(f"/api/v1/quote-cost-estimates/{quote['quote_id']}",headers=headers).json()
    assert Decimal(costs["cost"])==Decimal(".25")
    scope=db.get(QuoteWorkScope,quote["quote_id"]);assert scope.configuration["occurrences"]==1
    assert client.patch(f"/api/v1/quotes/{quote['quote_id']}",headers=headers,json={"status":"sent"}).status_code==200
    accepted=client.post(f"/api/v1/quotes/{quote['quote_id']}/accept",headers=headers,json={"register_client":False})
    assert accepted.status_code==200,accepted.text
    budget=db.query(MarginForecast).filter_by(company_id=company.id).one()
    assert budget.planned_direct_cost_amount==Decimal(".25")
    from app.models.service_contract import ServiceContract
    contract=db.query(ServiceContract).filter_by(company_id=company.id).one()
    contract.status="active"
    order=WorkOrder(company_id=company.id,location_id=site["id"],title="Mismo servicio",service_contract_id=contract.id,scheduled_start_at=datetime(2026,12,10,8))
    db.add(order);db.commit()
    assert pricing_for_order(db,order,body["spaces"])=={"price":.32,"quantity":1,"unit":"service","pricing_mode":"fixed"}
    changed=deepcopy(body["spaces"]);changed[0]["employee_ids"]=[]
    assert pricing_for_order(db,order,changed)["price"]==.32
    changed[0]["task_ids"]=[]
    assert pricing_for_order(db,order,changed)=={}


def test_unknown_cost_and_duration_are_explicit_and_block_draft(client,db):
    _,_,headers,_,_,_,_,body=setup(client,db,"incomplete",minutes=None,rate=0)
    result=preview(client,headers,body)
    assert result["total_cost"] is None and result["suggested_unit_price"] is None and not result["can_save"]
    assert result["labor_cost"] is None
    assert result["labor"][0]["cost"] is None and result["labor"][0]["minutes"] is None
    assert any("coste laboral" in note for note in result["missing"])
    assert any("duración" in note for note in result["missing"])
    assert create(client,headers,body,result).status_code==422
    body["spaces"][0]["planned_minutes"]=30
    assert preview(client,headers,body)["labor"][0]["duration_source"]=="Previsión manual"


def test_sources_rechecked_and_manual_cost_edit_clears_exact_override(client,db):
    _,_,headers,_,_,_,person,body=setup(client,db,"rate-change")
    initial=preview(client,headers,body)
    person.hourly_cost=30;db.commit()
    assert create(client,headers,body,initial).status_code==409
    fresh=preview(client,headers,body);assert Decimal(fresh["labor_cost"])==Decimal(".50")
    quote=create(client,headers,body,fresh).json()
    edit=client.put(f"/api/v1/quote-cost-estimates/{quote['quote_id']}",headers=headers,json={"revision":1,"labor_hours":"1","hourly_cost":"15","materials":"0","other_costs":"0"})
    assert edit.status_code==200,edit.text
    assert edit.json()["labor_amount"] is None and Decimal(edit.json()["cost"])==15


def test_real_warehouse_cost_and_tenant_permissions_are_enforced(client,db):
    company,_,headers,_,_,spaces,person,body=setup(client,db,"real-stock",minutes=60)
    material=InventoryMaterial(company_id=company.id,sku="REAL",name="Detergente",unit="liter")
    warehouse=InventoryWarehouse(company_id=company.id,name="Almacén")
    db.add_all([material,warehouse]);db.flush()
    db.add(InventoryMovement(company_id=company.id,material_id=material.id,warehouse_id=warehouse.id,movement_type="receipt",quantity=10,unit_cost=2))
    db.commit()
    body["materials"]=[{"material_id":material.id,"warehouse_id":warehouse.id,"quantity":"2.5"}]
    result=preview(client,headers,body)
    assert Decimal(result["material_cost"])==5 and Decimal(result["total_cost"])==20
    assert Decimal(result["suggested_unit_price"])==25
    options=client.get(f"/api/v1/service-estimator/options?location_id={body['location_id']}",headers=headers)
    assert options.status_code==200 and options.json()["materials"][0]["id"]==material.id
    body["spaces"][0]["task_ids"]=[spaces[1]["tasks"][0]["id"]]
    assert client.post("/api/v1/service-estimator/preview",headers=headers,json=body).status_code==422
    body["spaces"][0]["task_ids"]=[spaces[0]["tasks"][0]["id"]]
    external=_headers(_bootstrap_admin(db,_company(db,"estimator-other"),"estimator-other"))
    assert client.post("/api/v1/service-estimator/preview",headers=external,json=body).status_code==404
    foreign_material=InventoryMaterial(company_id=2,sku="FOR",name="Otro",unit="liter");db.add(foreign_material);db.commit()
    body["materials"][0]["material_id"]=foreign_material.id
    assert client.post("/api/v1/service-estimator/preview",headers=headers,json=body).status_code==404
    worker=_user(db,company,"estimator-denied",role_id=3);db.commit()
    assert client.get("/api/v1/service-estimator/options",headers=_headers(worker)).status_code==403


def test_quote_opportunity_must_belong_to_same_client_and_company(client,db):
    company,_,headers,customer,_,_,_,body=setup(client,db,"opportunity-check")
    other=_client(client,headers)
    wrong=ClientOpportunity(client_id=other["id"],title="Otro cliente",stage="new")
    right=ClientOpportunity(client_id=customer["id"],title="Mismo cliente",stage="new")
    db.add_all([wrong,right]);db.commit()
    result=preview(client,headers,body)
    assert create(client,headers,body,result,opportunity_id=wrong.id).status_code==404
    filtered=client.get(f"/api/v1/service-estimator/options?opportunity_id={right.id}",headers=headers).json()
    assert filtered["opportunity"]["id"]==right.id and all(site["client_id"]==customer["id"] for site in filtered["locations"])
    saved=create(client,headers,body,result,opportunity_id=right.id)
    assert saved.status_code==201,saved.text
    assert db.get(QuoteWorkScope,saved.json()["quote_id"]).opportunity_id==right.id


def test_forecast_access_does_not_grant_historical_fichaje_access(client,db):
    from app.services.company_entitlement_service import set_company_entitlement_override
    company,_,headers,_,_,_,_,body=setup(client,db,"history-permissions")
    # Keep the canonical company-administrator grant; only this company's time feature is unavailable.
    set_company_entitlement_override(db,company_id=company.id,code="features.time_tracking",value=False,
        reason="Historical access boundary test",actor_user_id=None)
    db.commit()
    response=client.post("/api/v1/service-estimator/preview",headers=headers,json=body)
    assert response.status_code==200,response.text
    result=response.json()
    assert result["can_save"] and Decimal(result["labor_cost"])==Decimal(".25")
    assert result["historical"]["available"] is False
    assert result["historical"]["average_person_hours"] is None and result["historical"]["average_labor_cost"] is None
