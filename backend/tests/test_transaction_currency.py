from datetime import datetime
from decimal import Decimal
import io,zipfile
import pytest
from app.models.invoice import Invoice
from app.models.expense import Expense
from app.models.client import Client
from app.models.customer_payment import CustomerPayment
from app.models.sales_ledger_record import SalesLedgerRecord
from tests.test_accounting_periods import setup,close
from tests.test_client_permission_authorization import _company,_bootstrap_admin,_headers,_user


def spec(document,rate="0.9",currency="USD",date="2026-10-15",**extra):
    return {"currency":currency,"eur_rate":rate,"rate_date":date,"rate_verified":True,"document":document,**extra}


def invoice_document(customer):
    return {"client_id":customer["id"],"issue_date":"2026-10-15T12:00:00Z","items":[{"description":"Servicio original","quantity":1,"unit_price":100,"tax_rate":0}]}


def post(client,headers,kind,body):
    response=client.post("/api/v1/transaction-currency/"+kind,headers=headers,json=body)
    assert response.status_code==201,response.text
    return response.json()


@pytest.mark.parametrize("paid_rate,difference", [("0.95","5.00"),("0.85","-5.00")])
def test_foreign_invoice_receipt_settlement_preserves_eur_and_realized_fx(client,db,paid_rate,difference):
    company,_,headers,customer=setup(client,db,"currency-"+paid_rate)
    db.get(Client,customer["id"]).legal_number="B12345678";db.commit()
    record=post(client,headers,"invoices",spec(invoice_document(customer)))
    invoice=db.get(Invoice,record["id"])
    assert invoice.base_amount==90 and invoice.total_amount==90
    assert invoice.currency_snapshot["original_amounts"]["total_amount"]=="100.00"
    issued=client.post(f"/api/v1/invoices/{invoice.id}/issue",headers=headers)
    assert issued.status_code==200,issued.text
    pdf=client.get(f"/api/v1/invoices/{invoice.id}/pdf",headers=headers)
    assert pdf.status_code==200 and pdf.content.startswith(b"%PDF")
    closed=close(client,headers,company.id,month="2026-10")
    receipt=post(client,headers,"payments",spec({"client_id":customer["id"],"received_at":"2026-11-15T12:00:00Z","amount":"100"},rate=paid_rate,date="2026-11-15",settle_invoice_id=invoice.id,settled_native_amount="100"))
    payment=db.get(CustomerPayment,receipt["id"])
    assert payment.amount==Decimal(paid_rate)*100
    assert payment.allocations[0].amount==90
    assert payment.allocations[0].exchange_difference_eur==Decimal(difference)
    canonical=client.get("/api/v1/customer-payments/",headers=headers).json()[0]
    assert Decimal(canonical["unapplied_amount"])==0 and Decimal(canonical["exchange_difference_amount"])==Decimal(difference)
    db.refresh(invoice);assert invoice.status=="paid"
    report=client.get("/api/v1/management-insights?month=2026-11",headers=headers)
    assert report.status_code==200,report.text
    assert Decimal(report.json()["finance"]["realized_exchange_difference"])==Decimal(difference)
    frozen=client.get(f"/api/v1/accounting-periods/{company.id}/2026-10",headers=headers).json()
    assert frozen["snapshot"]==closed["snapshot"]
    corrected=client.post(f"/api/v1/invoices/{invoice.id}/rectify",headers=headers,json={"reason":"Rectificación actual","issue_date":"2026-11-16T12:00:00Z"})
    assert corrected.status_code==201,corrected.text
    snapshot=corrected.json()["currency_snapshot"]
    assert snapshot["currency"]=="USD" and Decimal(snapshot["original_amounts"]["total_amount"])==-100
    assert corrected.json()["total_amount"]==-90


def test_foreign_expense_sales_and_export_use_native_snapshot_and_eur_reporting(client,db):
    company,_,headers,_=setup(client,db,"currency-costs")
    expense=post(client,headers,"expenses",spec({"expense_date":"2026-10-15T12:00:00Z","category":"Productos","description":"Compra original","base_amount":100,"tax_amount":20}))
    sale=post(client,headers,"sales",spec({"document_number":"FOREIGN-1","entry_date":"2026-10-15","client_name":"Cliente exterior","base_amount":"200","tax_amount":"0"}))
    assert db.get(Expense,expense["id"]).total_amount==108
    assert db.get(SalesLedgerRecord,sale["id"]).base_amount==180
    report=client.get("/api/v1/management-insights?month=2026-10",headers=headers).json()
    assert Decimal(report["finance"]["revenue_base"])==180 and Decimal(report["finance"]["registered_expense_and_material_cost"])==90
    denied=client.patch(f"/api/v1/expenses/{expense['id']}",headers=headers,json={"base_amount":300})
    assert denied.status_code==409,denied.text
    db.rollback()
    note=client.patch(f"/api/v1/expenses/{expense['id']}",headers=headers,json={"notes":"Conservar nota actual"})
    assert note.status_code==200,note.text
    edited=client.put(f"/api/v1/transaction-currency/expenses/{expense['id']}",headers=headers,json=spec({"expense_date":"2026-10-15T12:00:00Z","category":"Productos","description":"Cambio original","base_amount":120,"tax_amount":0}))
    assert edited.status_code==200,edited.text
    assert db.get(Expense,expense["id"]).base_amount==108
    assert db.get(Expense,expense["id"]).notes=="Conservar nota actual"
    exported=client.get(f"/api/v1/advisory/{company.id}/accounting?year=2026",headers=headers)
    assert exported.status_code==200,exported.text
    archive=zipfile.ZipFile(io.BytesIO(exported.content))
    entry=next(name for name in archive.namelist() if name.startswith("monedas_originales_"))
    content=archive.read(entry).decode("utf-8-sig")
    assert "USD" in content and "0.9" in content and "FOREIGN" not in content
    closed=close(client,headers,company.id,month="2026-10")
    assert Decimal(closed["snapshot"]["amounts"]["expense_base"])==108


def test_legacy_eur_is_preserved_and_foreign_api_permissions_fail_closed(client,db):
    company,_,headers,customer=setup(client,db,"currency-auth")
    legacy=Expense(company_id=company.id,expense_date=datetime(2026,10,15),category="General",description="EUR legacy",base_amount=10,tax_amount=0,total_amount=10)
    db.add(legacy);db.commit()
    body=spec({"expense_date":"2026-10-15T12:00:00Z","category":"General","description":"Original","base_amount":100,"tax_amount":0})
    assert client.put(f"/api/v1/transaction-currency/expenses/{legacy.id}",headers=headers,json=body).status_code==409
    assert db.get(Expense,legacy.id).currency_snapshot is None and db.get(Expense,legacy.id).base_amount==10
    worker=_user(db,company,"currency-denied",role_id=3);db.commit()
    assert client.post("/api/v1/transaction-currency/expenses",headers=_headers(worker),json=body).status_code==403
    other=_headers(_bootstrap_admin(db,_company(db,"currency-other"),"currency-other"))
    assert client.put(f"/api/v1/transaction-currency/expenses/{legacy.id}",headers=other,json=body).status_code==404
    assert client.post("/api/v1/transaction-currency/invoices",headers=other,json=spec(invoice_document(customer))).status_code==404
    assert client.post("/api/v1/transaction-currency/expenses",headers=headers,json={**body,"rate_verified":False}).status_code==422
    assert client.post("/api/v1/transaction-currency/expenses",headers=headers,json={**body,"currency":"EUR","eur_rate":"2"}).status_code==422

    from app.services.company_entitlement_service import set_company_entitlement_override
    set_company_entitlement_override(db,company_id=company.id,code="features.invoices",value=False,reason="FX workspace feature boundary",actor_user_id=None);db.commit()
    assert client.get("/api/v1/transaction-currency",headers=headers).status_code==403
    assert client.post("/api/v1/transaction-currency/expenses",headers=headers,json=body).status_code==403


def test_native_minor_units_and_date_precision_are_real_not_relabelled_eur(client,db):
    _,_,headers,_=setup(client,db,"currency-minor")
    body=spec({"expense_date":"2026-10-15T12:00:00Z","category":"General","description":"Bahraini native","base_amount":10.125,"tax_amount":0},rate="2.4",currency="BHD")
    saved=post(client,headers,"expenses",body)
    assert saved["currency_snapshot"]["original_amounts"]["base_amount"]=="10.125"
    assert saved["amount_eur"]=="24.3" or Decimal(saved["amount_eur"])==Decimal("24.30")
    invalid={**body,"currency":"JPY"}
    assert client.post("/api/v1/transaction-currency/expenses",headers=headers,json=invalid).status_code==422
    db.rollback()
    invalid={**body,"rate_date":"2026-10-16"}
    assert client.post("/api/v1/transaction-currency/expenses",headers=headers,json=invalid).status_code==422


def test_native_unit_precision_does_not_erase_large_quantity_invoice_value(client,db):
    _,_,headers,customer=setup(client,db,"currency-small-unit")
    document=invoice_document(customer)
    document["items"]=[{"description":"Precio unitario original pequeño","quantity":1000000,"unit_price":0.00001,"tax_rate":0}]
    record=post(client,headers,"invoices",spec(document))
    invoice=db.get(Invoice,record["id"])
    assert invoice.base_amount==Decimal("9.00") and invoice.total_amount==Decimal("9.00")
    assert invoice.items[0].quantity==1 and invoice.items[0].unit_price==9
    assert "1000000" in invoice.items[0].description and "0.00001 USD" in invoice.items[0].description
    assert Decimal(invoice.currency_snapshot["original_amounts"]["total_amount"])==Decimal("10.00")
    assert Decimal(invoice.currency_snapshot["original_lines"][0]["unit_price"])==Decimal("0.00001")
    assert Decimal(invoice.currency_snapshot["rounding_difference_eur"])==0


def test_native_quantity_precision_is_preserved_in_snapshot_and_equivalent_eur_line(client,db):
    _,_,headers,customer=setup(client,db,"currency-fine-quantity")
    document=invoice_document(customer)
    document["items"]=[{"description":"Cantidad original exacta","quantity":1.000001,"unit_price":100,"tax_rate":0}]
    record=post(client,headers,"invoices",spec(document))
    invoice=db.get(Invoice,record["id"])
    assert invoice.total_amount==90 and invoice.items[0].quantity==1
    assert Decimal(invoice.currency_snapshot["original_lines"][0]["quantity"])==Decimal("1.000001")
    assert "1.000001" in invoice.items[0].description
