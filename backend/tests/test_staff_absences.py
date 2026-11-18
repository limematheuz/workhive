from app.models.staff_employee import StaffEmployee
from tests.test_client_permission_authorization import _bootstrap_admin, _company, _headers


def test_coverage_conflicts_and_company_scope(client, db):
    company = _company(db, "coverage")
    other = _company(db, "other-coverage")
    admin = _bootstrap_admin(db, company, "coverage-admin")
    outside = _bootstrap_admin(db, other, "outside-coverage-admin")
    staff = [StaffEmployee(company_id=company.id, name=n, position="Limpieza", team="Norte",
                          monthly_hours=160, hourly_cost=14, profile={"state": "Activo"}) for n in ("Ana","Luis","Eva")]
    db.add_all(staff)
    db.commit()
    ana,luis,eva = [person.id for person in staff]
    url = "/api/v1/staff-absences"
    data = dict(employee_id=ana,substitute_id=luis,starts_on="2026-11-20",ends_on="2026-11-22",kind="Permiso")
    created = client.post(url,headers=_headers(admin),json=data)
    assert created.status_code == 201, created.text
    assert client.post(url,headers=_headers(admin),json={**data,"employee_id":eva}).status_code == 409
    assert client.get(url,headers=_headers(outside)).json() == []
    assert client.post(url,headers=_headers(outside),json=data).status_code == 404
    assert client.put(url+"/"+str(created.json()["id"]),headers=_headers(admin),json={**data,"substitute_id":None}).status_code == 200
    assert client.post(url,headers=_headers(admin),json={**data,"employee_id":eva}).status_code == 201
