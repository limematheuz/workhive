
from app.models.staff_employee import StaffEmployee
from tests.test_client_permission_authorization import _bootstrap_admin, _company, _headers
from test_service_contracts import _client, _location


def test_shift_coverage_conflicts_and_cross_company(client, db):
    company = _company(db,"shift-coverage")
    admin = _bootstrap_admin(db,company,"shift-admin")
    headers = _headers(admin)
    customer = _client(client,headers)
    site = _location(client,headers,customer["id"])
    people = [StaffEmployee(company_id=company.id,name=name,position="Limpieza",team="A",monthly_hours=160,hourly_cost=15) for name in ("María","David")]
    db.add_all(people);db.commit()
    url = "/api/v1/staff-shifts"
    body = dict(employee_id=people[0].id,location_id=site["id"],starts_at="2026-11-20T08:00:00Z",ends_at="2026-11-20T10:00:00Z")
    created = client.post(url,headers=headers,json=body)
    assert created.status_code == 201, created.text
    assert client.post(url,headers=headers,json=body).status_code == 409
    leave = dict(employee_id=people[0].id,substitute_id=people[1].id,starts_on="2026-11-20",ends_on="2026-11-20",kind="Vacaciones")
    assert client.post("/api/v1/staff-absences",headers=headers,json=leave).status_code == 201
    rows = client.get(url,headers=headers).json()
    assert rows[0]["effective_employee_id"] == people[1].id
    roster_url=url+"/roster?start=2026-11-20T00:00:00Z&end=2026-11-21T00:00:00Z"
    roster=client.get(roster_url,headers=headers)
    assert roster.status_code==200,roster.text
    assert roster.json()["items"][0]["employee_name"]=="David"
    assert "hourly_cost" not in roster.json()["items"][0]
    body["employee_id"] = people[1].id
    assert client.post(url,headers=headers,json=body).status_code == 409
    other = _headers(_bootstrap_admin(db,_company(db,"shift-other"),"shift-other"))
    assert client.get(url,headers=other).json() == []
    assert client.get(roster_url,headers=other).json()["items"]==[]
    assert client.put(url + "/" + str(created.json()["id"]),headers=other,json=body).status_code in (403,404)
