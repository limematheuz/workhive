
from datetime import date
from app.models.staff_employee import StaffEmployee
from app.models.staff_absence import StaffAbsence
from app.models.notification import Notification
from tests.test_client_permission_authorization import _bootstrap_admin,_company,_headers


def test_import_is_atomic_and_retry_is_idempotent(client,db):
    company=_company(db,"delivery-import")
    user=_bootstrap_admin(db,company,"delivery-import")
    headers=_headers(user)
    url="/api/v1/data-import"
    content=("nombre;cargo;equipo;horas_mes;coste_hora"+chr(10)+"Prueba importada;Limpieza;Centro;160;15"+chr(10)).encode()
    preview=client.post(url+"/preview?kind=staff",headers=headers,files={"file":("plantilla.csv",content,"text/csv")})
    assert preview.status_code==200,preview.text
    payload={"kind":"staff","records":preview.json()}
    created=client.post(url+"/execute",headers=headers,json=payload)
    assert created.status_code==200,created.text
    repeated=client.post(url+"/execute",headers=headers,json=payload)
    assert repeated.json()["ids"]==created.json()["ids"] and repeated.json()["already_imported"]
    invalid=client.post(url+"/execute",headers=headers,json={"kind":"staff","records":[payload["records"][0],{"name":"","position":"Limpieza"}]})
    assert invalid.status_code==422
    assert db.query(StaffEmployee).filter_by(company_id=company.id).count()==1


def test_approved_vacation_generates_absence_once(client,db):
    company=_company(db,"delivery-request")
    user=_bootstrap_admin(db,company,"delivery-request")
    headers=_headers(user)
    employee=StaffEmployee(company_id=company.id,name="Prueba solicitud",position="Limpieza",team="A",monthly_hours=160,hourly_cost=15)
    db.add(employee);db.commit()
    base="/api/v1/internal-requests"
    created=client.post(base,headers=headers,json={"employee_id":employee.id,"kind":"vacation","description":"Vacaciones de prueba",
        "starts_on":"2026-12-01","ends_on":"2026-12-02"})
    assert created.status_code==201,created.text
    url=f"{base}/{created.json()['id']}/review"
    approved=client.post(url,headers=headers,json={"decision":"approved"})
    assert approved.status_code==200,approved.text
    assert approved.json()["absence_id"]
    assert client.post(url,headers=headers,json={"decision":"approved"}).status_code==200
    assert db.query(StaffAbsence).count()==1


def test_document_automation_deduplicates_alerts(client,db):
    company=_company(db,"delivery-automation")
    user=_bootstrap_admin(db,company,"delivery-automation")
    headers=_headers(user)
    db.add(StaffEmployee(company_id=company.id,name="Prueba formación",position="Limpieza",team="A",monthly_hours=160,hourly_cost=15,
        profile={"documents":[{"name":"Prevención","url":"https://example.com/training","expires_on":"2026-01-01","version":"1"}]}))
    db.commit()
    base="/api/v1/operations-automation"
    assert client.put(base,headers=headers,json={"documents":True}).status_code==200
    first=client.post(base+"/run",headers=headers)
    assert first.status_code==200,first.text
    count=db.query(Notification).filter_by(event_type="staff.document_due",user_id=user.id).count()
    assert count==1
    assert client.post(base+"/run",headers=headers).status_code==200
    assert db.query(Notification).filter_by(event_type="staff.document_due",user_id=user.id).count()==count


def test_consolidation_denies_unrelated_company(client,db):
    company=_company(db,"delivery-group")
    other=_company(db,"delivery-unrelated")
    company.subscription_plan="mega"
    user=_bootstrap_admin(db,company,"delivery-group")
    headers=_headers(user)
    base="/api/v1/consolidation"
    companies=client.get(base+"/companies",headers=headers)
    assert companies.status_code==200,companies.text
    assert company.id in [c["id"] for c in companies.json()]
    body={"companies":[company.id],"reference_date":date.today().isoformat(),"currency":"USD","eur_rate":"1.1"}
    result=client.post(base+"/report",headers=headers,json=body)
    assert result.status_code==200,result.text
    body["companies"]=[other.id]
    assert client.post(base+"/report",headers=headers,json=body).status_code==403
