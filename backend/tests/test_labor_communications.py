from app.models.user import User
from app.models.external_access_grant import ExternalAccessGrant
from app.models.advisory_access import AdvisoryAccess
from app.models.staff_employee import StaffEmployee
from tests.test_client_permission_authorization import _company,_bootstrap_admin,_headers


def fixture(db):
    company=_company(db,"labor-comms");company.subscription_plan="top"
    owner=_bootstrap_admin(db,company,"labor-comms-owner")
    worker=StaffEmployee(company_id=company.id,name="Persona trabajadora",position="Limpieza",team="A",monthly_hours=160,hourly_cost=15,profile={})
    adviser=User(company_id=company.id,role_id=5,email="labor-adviser@example.test",full_name="Gestoría laboral",hashed_password="unused",is_active=True)
    db.add_all([worker,adviser]);db.flush()
    grant=ExternalAccessGrant(company_id=company.id,user_id=adviser.id,access_type="accountant",status="active")
    db.add(grant);db.flush();area=AdvisoryAccess(grant_id=grant.id,accounting=False,payroll=True);db.add(area);db.commit()
    return company,owner,worker,adviser,area


def test_labor_hire_receipt_tracking_is_scoped_and_audited(client,db):
    company,owner,worker,adviser,area=fixture(db)
    endpoint=f"/api/v1/labor-communications/{company.id}"
    payload=dict(employee_id=worker.id,recipient_user_id=adviser.id,kind="hire",effective_on="2026-12-01",subject="Alta de trabajadora",description="Documentación y fecha de incorporación comunicadas.")
    response=client.post(endpoint,headers=_headers(owner),json=payload);assert response.status_code==201,response.text
    row=response.json();assert row["status"]=="sent" and len(row["events"])==1
    status=f"{endpoint}/{row['id']}/status"
    assert client.post(status,headers=_headers(owner),json={"expected_revision":1,"status":"received"}).status_code==403
    for version,state in enumerate(("received","processing","completed"),1):
        response=client.post(status,headers=_headers(adviser),json={"expected_revision":version,"status":state,"note":"Seguimiento"})
        assert response.status_code==200,response.text
    assert len(response.json()["events"])==4
    assert client.post(status,headers=_headers(adviser),json={"expected_revision":4,"status":"received"}).status_code==409
    area.payroll=False;area.accounting=True;db.commit()
    assert client.get(endpoint,headers=_headers(adviser)).status_code==403


def test_labor_communications_reject_foreign_employee_recipient_and_stale_state(client,db):
    company,owner,worker,adviser,area=fixture(db)
    other=_company(db,"labor-foreign");foreign=_bootstrap_admin(db,other,"labor-foreign")
    endpoint=f"/api/v1/labor-communications/{company.id}"
    payload=dict(employee_id=worker.id,recipient_user_id=adviser.id,kind="termination",effective_on="2026-12-01",subject="Baja comunicada",description="Solicitud pendiente de recepción.")
    assert client.post(endpoint,headers=_headers(foreign),json=payload).status_code in (403,404)
    assert client.post(endpoint,headers=_headers(owner),json={**payload,"recipient_user_id":foreign.id}).status_code==422
    assert client.post(endpoint,headers=_headers(owner),json={**payload,"document_revision_ids":[999999]}).status_code==422
    created=client.post(endpoint,headers=_headers(owner),json=payload);assert created.status_code==201,created.text
    status=f"{endpoint}/{created.json()['id']}/status"
    assert client.post(status,headers=_headers(adviser),json={"expected_revision":2,"status":"received"}).status_code==409
    assert client.post(status,headers=_headers(adviser),json={"expected_revision":1,"status":"rejected"}).status_code==422
    response=client.post(status,headers=_headers(adviser),json={"expected_revision":1,"status":"rejected","note":"Falta el documento firmado"})
    assert response.status_code==200,response.text
    assert response.json()["events"][-1]["note"]=="Falta el documento firmado"


def test_only_recipient_adviser_receives_communication_and_documents(client,db):
    from tests.test_document_register import upload
    company,owner,worker,adviser,area=fixture(db)
    peer=User(company_id=company.id,role_id=5,email="other-adviser@example.test",full_name="Otra gestoría",hashed_password="unused",is_active=True)
    db.add(peer);db.flush();grant=ExternalAccessGrant(company_id=company.id,user_id=peer.id,access_type="accountant",status="active")
    db.add(grant);db.flush();db.add(AdvisoryAccess(grant_id=grant.id,accounting=True,payroll=True));db.commit()
    document=upload(client,_headers(owner),"staff",worker.id)
    endpoint=f"/api/v1/labor-communications/{company.id}"
    body=dict(employee_id=worker.id,recipient_user_id=adviser.id,kind="contract_change",effective_on="2026-12-01",subject="Cambio contractual",description="Revisar documento adjunto",document_revision_ids=[document["current"]["id"]])
    result=client.post(endpoint,headers=_headers(owner),json=body);assert result.status_code==201,result.text
    assert result.json()["documents"][0]["revision_id"]==document["current"]["id"]
    assert client.get(endpoint,headers=_headers(peer)).json()["items"]==[]
    status=f"{endpoint}/{result.json()['id']}/status"
    assert client.post(status,headers=_headers(peer),json={"expected_revision":1,"status":"received"}).status_code==404
    assert client.get(result.json()["documents"][0]["download_url"],headers=_headers(adviser)).status_code==200
    area.payroll=False;area.accounting=True;db.commit()
    assert client.get(result.json()["documents"][0]["download_url"],headers=_headers(adviser)).status_code==403
