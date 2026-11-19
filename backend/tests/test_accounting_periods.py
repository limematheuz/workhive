from datetime import datetime,timezone
from decimal import Decimal
import pytest
from fastapi import HTTPException
from sqlalchemy import update,delete
from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.customer_payment import CustomerPayment
from app.models.inventory import InventoryMaterial,InventoryWarehouse,InventoryMovement
from app.models.accounting_period import AccountingPeriodEvent
from tests.test_client_permission_authorization import _company,_bootstrap_admin,_headers,_user
from test_service_contracts import _client


def setup(client,db,suffix):
    company=_company(db,suffix);company.tax_id="A12345678";admin=_bootstrap_admin(db,company,suffix);headers=_headers(admin)
    customer=_client(client,headers)
    return company,admin,headers,customer


def close(client,headers,company,month="2026-11",revision=0):
    response=client.post(f"/api/v1/accounting-periods/{company}/{month}/close",headers=headers,json={"reason":"Revisión y cierre del mes","expected_revision":revision})
    assert response.status_code==200,response.text
    return response.json()


def expense_body(when="2026-11-15T12:00:00Z"):
    return {"expense_date":when,"category":"Suministros","description":"Gasto real","base_amount":100,"tax_amount":21}


def test_closed_month_blocks_canonical_expenses_date_moves_and_reopens_with_history(client,db):
    company,_,headers,_=setup(client,db,"period-expenses")
    initial=client.post("/api/v1/expenses/",headers=headers,json=expense_body());assert initial.status_code==201,initial.text
    expense=initial.json();closed=close(client,headers,company.id)
    assert closed["snapshot"]["amounts"]["expense_base"]=="100.00"
    assert client.patch(f"/api/v1/expenses/{expense['id']}",headers=headers,json={"base_amount":120}).status_code==409;db.rollback()
    assert client.patch(f"/api/v1/expenses/{expense['id']}",headers=headers,json={"expense_date":"2026-12-15T12:00:00Z"}).status_code==409;db.rollback()
    assert client.delete(f"/api/v1/expenses/{expense['id']}",headers=headers).status_code==409;db.rollback()
    assert client.post("/api/v1/expenses/",headers=headers,json=expense_body()).status_code==409;db.rollback()
    december=client.post("/api/v1/expenses/",headers=headers,json=expense_body("2026-12-15T12:00:00Z"));assert december.status_code==201,december.text
    assert client.patch(f"/api/v1/expenses/{december.json()['id']}",headers=headers,json={"expense_date":"2026-11-15T12:00:00Z"}).status_code==409;db.rollback()
    endpoint=f"/api/v1/accounting-periods/{company.id}/2026-11/reopen"
    assert client.post(endpoint,headers=headers,json={"reason":"Corrección de importe","expected_revision":0}).status_code==409;db.rollback()
    reopened=client.post(endpoint,headers=headers,json={"reason":"Corrección de importe","expected_revision":1});assert reopened.status_code==200,reopened.text
    assert reopened.json()["status"]=="open" and reopened.json()["revision"]==2
    assert client.patch(f"/api/v1/expenses/{expense['id']}",headers=headers,json={"base_amount":120}).status_code==200
    again=close(client,headers,company.id,revision=2)
    assert again["snapshot"]["amounts"]["expense_base"]=="120.00" and len(again["history"])==3
    old=db.query(AccountingPeriodEvent).filter_by(company_id=company.id,revision=1).one()
    assert old.snapshot["amounts"]["expense_base"]=="100.00"
    outsider=_headers(_bootstrap_admin(db,_company(db,"period-foreign"),"period-foreign"))
    assert client.get(f"/api/v1/accounting-periods/{company.id}/2026-11",headers=outsider).status_code==404
    worker=_user(db,company,"period-worker",role_id=3);db.commit()
    assert client.post(endpoint,headers=_headers(worker),json={"reason":"Cambio no autorizado","expected_revision":3}).status_code==403


def test_current_receipt_for_old_closed_invoice_allowed_but_old_receipt_void_denied(client,db):
    company,_,headers,customer=setup(client,db,"period-cash")
    invoice=Invoice(company_id=company.id,client_id=customer["id"],invoice_number="CASH-1",issue_date=datetime(2026,11,15),status="issued",base_amount=100,tax_amount=0,total_amount=100)
    db.add(invoice);db.commit()
    past=client.post("/api/v1/customer-payments/",headers=headers,json={"client_id":customer["id"],"received_at":"2026-11-16T12:00:00Z","amount":"25","allocations":[{"invoice_id":invoice.id,"amount":"25"}]})
    assert past.status_code==201,past.text
    closed=close(client,headers,company.id)
    now=client.post("/api/v1/customer-payments/",headers=headers,json={"client_id":customer["id"],"received_at":"2026-12-16T12:00:00Z","amount":"75","allocations":[{"invoice_id":invoice.id,"amount":"75"}]})
    assert now.status_code==201,now.text
    db.refresh(invoice);assert invoice.status=="paid"
    assert client.post(f"/api/v1/customer-payments/{past.json()['id']}/void",headers=headers,json={"reason":"No se puede alterar noviembre cerrado"}).status_code==409;db.rollback()
    assert client.post(f"/api/v1/customer-payments/{now.json()['id']}/void",headers=headers,json={"reason":"Corrección del cobro de diciembre"}).status_code==200
    stored=client.get(f"/api/v1/accounting-periods/{company.id}/2026-11",headers=headers).json()
    assert stored["snapshot"]["fingerprint"]==closed["snapshot"]["fingerprint"]
    assert stored["snapshot"]["amounts"]["receipts_total"]=="25.00"


def test_item_delete_and_async_sales_import_cannot_bypass_close(client,db):
    company,_,headers,customer=setup(client,db,"period-import")
    draft=client.post("/api/v1/invoices/drafts",headers=headers,json={"client_id":customer["id"],"issue_date":"2026-11-15T12:00:00Z","items":[{"description":"Servicio","unit_price":100,"quantity":1,"tax_rate":.21}]})
    assert draft.status_code==201,draft.text
    invoice=draft.json();close(client,headers,company.id)
    assert client.delete(f"/api/v1/invoices/{invoice['id']}/items/{invoice['items'][0]['id']}",headers=headers).status_code==409;db.rollback()
    content="N Factura;Fecha;Cliente;Importe Total;Base;IVA;Cobrada\nHIST-CLOSE;15/11/2026;Cliente;121;100;21;Pendiente\n"
    result=client.post("/api/v1/sales-ledger/manual-records/import",headers=headers,files={"file":("ventas.csv",content.encode("utf-8"),"text/csv")})
    assert result.status_code==409,result.text
    assert client.patch(f"/api/v1/invoices/{invoice['id']}",headers=headers,json={"issue_date":"2026-12-15T12:00:00Z"}).status_code==409;db.rollback()


def test_bulk_dml_and_inventory_reversal_check_original_closed_scope(client,db):
    company,_,headers,_=setup(client,db,"period-bulk")
    expense=Expense(company_id=company.id,expense_date=datetime(2026,11,10),category="General",description="Cerrado",base_amount=10,tax_amount=0,total_amount=10)
    material=InventoryMaterial(company_id=company.id,sku="PERIOD",name="Material",unit="unit")
    warehouse=InventoryWarehouse(company_id=company.id,name="Almacén")
    db.add_all([expense,material,warehouse]);db.flush()
    movement=InventoryMovement(company_id=company.id,material_id=material.id,warehouse_id=warehouse.id,movement_type="issue",quantity=1,unit_cost=3,created_at=datetime(2026,11,10))
    db.add(movement);db.commit();close(client,headers,company.id)
    for statement in (update(Expense).where(Expense.id==expense.id).values(base_amount=99),delete(Expense).where(Expense.id==expense.id)):
        with pytest.raises(HTTPException) as caught:db.execute(statement)
        assert caught.value.status_code==409;db.rollback()
    db.add(InventoryMovement(company_id=company.id,material_id=material.id,warehouse_id=warehouse.id,movement_type="receipt",quantity=1,unit_cost=3,reversal_of_movement_id=movement.id,created_at=datetime(2026,12,10)))
    with pytest.raises(HTTPException) as caught:db.commit()
    assert caught.value.status_code==409;db.rollback()


def test_accounting_adviser_needs_explicit_closure_right_and_cannot_reopen(client,db):
    from app.models.role import Role
    from app.models.external_access_grant import ExternalAccessGrant
    from app.models.advisory_access import AdvisoryAccess
    from tests.test_accountant_access import _headers as adviser_headers
    company,_,headers,_=setup(client,db,"period-adviser")
    role=db.query(Role).filter_by(name="external_portal").one()
    adviser,external=adviser_headers(db,company,role.id,"period-adviser-user")
    grant=ExternalAccessGrant(company_id=company.id,user_id=adviser.id,access_type="accountant",status="active")
    db.add(grant);db.flush();db.add(AdvisoryAccess(grant_id=grant.id,accounting=True,payroll=False));db.commit()
    endpoint=f"/api/v1/accounting-periods/{company.id}/2026-11"
    assert client.get(endpoint,headers=external).status_code==200
    body={"reason":"Revisión de gestoría","expected_revision":0}
    assert client.post(endpoint+"/close",headers=external,json=body).status_code==403
    changed=client.put("/api/v1/advisory/grants",headers=headers,json={"email":adviser.email,"accounting":True,"payroll":False,"can_close_periods":True})
    assert changed.status_code==200,changed.text
    assert client.post(endpoint+"/close",headers=external,json=body).status_code==200
    assert client.post(endpoint+"/reopen",headers=external,json={**body,"expected_revision":1}).status_code==403
    changed=client.put("/api/v1/advisory/grants",headers=headers,json={"email":adviser.email,"accounting":False,"payroll":True,"can_close_periods":True})
    assert changed.status_code==200
    assert client.get(endpoint,headers=external).status_code==403


def test_current_rectification_preserves_closed_original_and_its_snapshot(client,db):
    from app.models.client import Client
    company,_,headers,customer=setup(client,db,"period-rectification")
    db.get(Client,customer["id"]).legal_number="B12345678";db.commit()
    draft=client.post("/api/v1/invoices/drafts",headers=headers,json={"client_id":customer["id"],"issue_date":"2026-10-15T12:00:00Z","items":[{"description":"Servicio","unit_price":100,"quantity":1,"tax_rate":.21}]})
    assert draft.status_code==201,draft.text
    issued=client.post(f"/api/v1/invoices/{draft.json()['id']}/issue",headers=headers)
    assert issued.status_code==200,issued.text
    original=issued.json();closed=close(client,headers,company.id,month="2026-10")
    corrected=client.post(f"/api/v1/invoices/{original['id']}/rectify",headers=headers,json={"reason":"Corrección emitida en el periodo abierto","issue_date":"2026-11-15T12:00:00Z"})
    assert corrected.status_code==201,corrected.text
    assert corrected.json()["total_amount"]==-original["total_amount"]
    assert corrected.json()["original_invoice_id"]==original["id"]
    persisted=client.get(f"/api/v1/invoices/{original['id']}",headers=headers).json()
    assert persisted["base_amount"]==100 and persisted["total_amount"]==121 and persisted["status"]=="rectified"
    reread=client.get(f"/api/v1/accounting-periods/{company.id}/2026-10",headers=headers).json()
    assert reread["snapshot"]==closed["snapshot"]


def test_period_boundaries_use_utc_and_orm_bulk_insert_does_not_bypass_guard(client,db):
    from sqlalchemy import insert
    company,_,headers,_=setup(client,db,"period-timezone")
    close(client,headers,company.id)
    denied=client.post("/api/v1/expenses/",headers=headers,json=expense_body("2026-12-01T01:00:00+02:00"))
    assert denied.status_code==409,denied.text
    db.rollback()
    accepted=client.post("/api/v1/expenses/",headers=headers,json=expense_body("2026-11-30T23:30:00-02:00"))
    assert accepted.status_code==201,accepted.text
    assert db.get(Expense,accepted.json()["id"]).expense_date.month==12
    with pytest.raises(HTTPException) as caught:
        db.execute(insert(Expense),[{"company_id":company.id,"expense_date":datetime(2026,11,15),"category":"General","description":"Bulk","base_amount":10,"tax_amount":0,"total_amount":10}])
    assert caught.value.status_code==409
    db.rollback()
