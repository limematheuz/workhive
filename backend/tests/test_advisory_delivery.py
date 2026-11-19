from app.models.role import Role
from app.models.external_access_grant import ExternalAccessGrant
from app.models.advisory_access import AdvisoryAccess
from app.models.staff_employee import StaffEmployee
from app.models.staff_document_file import StaffDocumentFile
from tests.test_accountant_access import _company,_headers
from tests.test_client_permission_authorization import _bootstrap_admin,_headers as admin_headers


def test_adviser_requests_and_private_payroll_delivery_follow_area_grant(client,db):
    company=_company(db,"DELIVERY")
    owner=_bootstrap_admin(db,company,"delivery-owner")
    role=db.query(Role).filter_by(name="external_portal").one()
    adviser,headers=_headers(db,company,role.id,"delivery-advisor")
    grant=ExternalAccessGrant(company_id=company.id,user_id=adviser.id,access_type="accountant",status="active")
    db.add(grant);db.flush();areas=AdvisoryAccess(grant_id=grant.id,accounting=False,payroll=True);db.add(areas)
    worker=StaffEmployee(company_id=company.id,name="Trabajador de entrega",position="Limpieza",team="A",monthly_hours=160,hourly_cost=15,profile={"documents":[]})
    db.add(worker);db.commit()
    url=f"/api/v1/advisory-requests/{company.id}"
    request=client.post(url,headers=headers,json={"area":"payroll","description":"Confirmar variables del mes"})
    assert request.status_code==201,request.text
    assert client.post(url,headers=headers,json={"area":"accounting","description":"Sin autorización"}).status_code==403
    answered=client.put(url+f"/{request.json()['id']}",headers=admin_headers(owner),json={"response":"Horas aprobadas disponibles en el periodo."})
    assert answered.status_code==200,answered.text
    assert client.get(url,headers=headers).json()[0]["response"]
    payroll=f"/api/v1/advisory/{company.id}/staff/{worker.id}/payroll?month=2026-11"
    files={"file":("nomina.pdf",b"%PDF-1.4\n%%EOF","application/pdf")}
    uploaded=client.post(payroll,headers=headers,files=files)
    assert uploaded.status_code==201,uploaded.text
    download=uploaded.json()["url"]
    assert client.get(download,headers=headers).status_code==200
    assert client.post(payroll,headers=headers,files=files).status_code==201
    assert db.query(StaffDocumentFile).count()==1
    areas.payroll=False;db.commit()
    assert client.get(download,headers=headers).status_code==403
    assert client.post(payroll,headers=headers,files=files).status_code==403
    assert client.get(url,headers=headers).status_code==403


def test_adviser_receipts_use_selected_company_and_revoke_immediately(client,db):
    from datetime import datetime,timezone
    from tests.test_expense_receipts import _expense,PDF
    first=_company(db,"ACCOUNTING-FIRST")
    second=_company(db,"ACCOUNTING-SECOND")
    owner=_bootstrap_admin(db,second,"accounting-owner")
    role=db.query(Role).filter_by(name="external_portal").one()
    adviser,headers=_headers(db,first,role.id,"accounting-advisor")
    for company in (first,second):
        grant=ExternalAccessGrant(company_id=company.id,user_id=adviser.id,access_type="accountant",status="active")
        db.add(grant);db.flush();db.add(AdvisoryAccess(grant_id=grant.id,accounting=True,payroll=False))
    expense=_expense(db,second,owner)
    db.commit()
    response=client.post(f"/api/v1/expenses/{expense.id}/receipt",headers=admin_headers(owner),files={"file":("ticket.pdf",PDF,"application/pdf")})
    assert response.status_code==201,response.text
    url=f"/api/v1/advisory-accounting/{second.id}"
    result=client.get(url+"?month="+datetime.now(timezone.utc).strftime("%Y-%m"),headers=headers)
    assert result.status_code==200,result.text
    receipt=result.json()["expenses"][0]["receipt"]
    assert client.get(receipt,headers=headers).content==PDF
    assert client.get(f"/api/v1/advisory-accounting/{first.id}/expenses/{expense.id}/receipt",headers=headers).status_code==404
    grant=db.query(ExternalAccessGrant).filter_by(company_id=second.id,user_id=adviser.id).one()
    areas=db.get(AdvisoryAccess,grant.id);areas.accounting=False;areas.payroll=True;db.commit()
    assert client.get(receipt,headers=headers).status_code==403
