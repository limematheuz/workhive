from decimal import Decimal
from app.models.expense import Expense
from app.models.staff_employee import StaffEmployee
from tests.test_inventory_work_order_consumption import _inventory_company,_work_order,_lot_receipt
from tests.test_location_workspace import _admin,_headers
from tests.test_client_permission_authorization import _bootstrap_admin,_company


def test_material_plan_compares_actual_consumption_and_corrections(client,db):
    company=_inventory_company(db,"material-budget")
    headers=_headers(_admin(db,company))
    order=_work_order(client,db,headers,company)
    material,warehouse,purchase=_lot_receipt(client,headers)
    url=f"/api/v1/material-plans/{order['id']}"
    result=client.put(url,headers=headers,json={"material_id":material["id"],"quantity":"2.000"})
    assert result.status_code==200,result.text
    generated=client.post(f"/api/v1/work-orders/{order['id']}/generate",headers=headers)
    assert generated.status_code==200,generated.text
    assert client.get(f"/api/v1/work-orders/{order['id']}/materials/state",headers=headers).json()["can_consume"] is True
    consumed=client.post(f"/api/v1/work-orders/{order['id']}/materials",headers=headers,json={"material_id":material["id"],"warehouse_id":warehouse["id"],"lot_id":purchase["lines"][0]["lot_id"],"quantity":"3"})
    assert consumed.status_code==201,consumed.text
    rows=client.get(url,headers=headers).json()
    assert Decimal(rows[0]["planned"])==2 and Decimal(rows[0]["used"])==3
    corrected=client.post(f"/api/v1/work-orders/{order['id']}/materials/{consumed.json()['id']}/reverse",headers=headers,json={"reason":"Registro corregido"})
    assert corrected.status_code==200,corrected.text
    assert Decimal(client.get(url,headers=headers).json()[0]["used"])==0
    other=_headers(_admin(db,_inventory_company(db,"material-other")))
    assert client.get(url,headers=other).status_code==404


def test_subcontract_requires_valid_documents_and_posts_cost_once(client,db):
    company=_inventory_company(db,"subcontract-owner")
    headers=_headers(_admin(db,company))
    order=_work_order(client,db,headers,company)
    generated=client.post(f"/api/v1/work-orders/{order['id']}/generate",headers=headers)
    assert generated.status_code==200,generated.text
    supplier=client.post("/api/v1/inventory/suppliers",headers=headers,json={"name":"Empresa externa de prueba"}).json()
    body={"work_order_id":order["id"],"supplier_id":supplier["id"],"amount":"120","description":"Cristales"}
    result=client.post("/api/v1/subcontracts",headers=headers,json=body)
    assert result.status_code==201,result.text
    url=f"/api/v1/subcontracts/{result.json()['id']}"
    assert client.post(url+"/review",headers=headers,json={"status":"completed"}).status_code==409
    body.update(document_url="https://example.com/prevencion.pdf",document_expires_on="2099-12-31")
    assert client.put(url,headers=headers,json=body).status_code==200
    approved=client.post(url+"/review",headers=headers,json={"status":"completed"})
    assert approved.status_code==200,approved.text
    assert approved.json()["expense_id"]
    assert client.post(url+"/review",headers=headers,json={"status":"completed"}).json()["expense_id"]==approved.json()["expense_id"]
    assert db.query(Expense).filter_by(work_order_id=order["id"]).count()==1
    other=_headers(_admin(db,_inventory_company(db,"subcontract-other")))
    assert client.post(url+"/review",headers=other,json={"status":"completed"}).status_code==404


def test_saved_report_retains_columns_but_rechecks_tenant_permissions(client,db):
    company=_company(db,"report-owner")
    user=_bootstrap_admin(db,company,"report-owner")
    headers=_headers(user)
    db.add(StaffEmployee(company_id=company.id,name="=Fórmula ficticia",position="Limpieza",team="A",monthly_hours=160,hourly_cost=15));db.commit()
    body={"name":"Plantilla","kind":"staff","columns":["name","hourly_cost"],"starts_on":"2026-01-01","ends_on":"2026-12-31"}
    result=client.post("/api/v1/custom-reports",headers=headers,json=body)
    assert result.status_code==201,result.text
    rows=client.post("/api/v1/custom-reports/run",headers=headers,json=body)
    assert rows.status_code==200,rows.text
    assert len(rows.json()["rows"])==1
    export=f"/api/v1/custom-reports/{result.json()['id']}/export"
    csv=client.get(export,headers=headers)
    assert csv.status_code==200 and "'=Fórmula" in csv.text
    other=_headers(_bootstrap_admin(db,_company(db,"report-other"),"report-other"))
    assert client.get(export,headers=other).status_code==404
    invalid=client.post("/api/v1/custom-reports/run",headers=headers,json={**body,"columns":["private_field"]})
    assert invalid.status_code==422
