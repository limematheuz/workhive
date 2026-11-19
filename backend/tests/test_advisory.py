
from app.models.role import Role
from app.models.external_access_grant import ExternalAccessGrant
from app.models.advisory_access import AdvisoryAccess
from tests.test_accountant_access import _company, _headers
from tests.test_client_permission_authorization import _bootstrap_admin, _headers as admin_headers


def test_independent_payroll_accounting_and_multiple_company_grants(client, db):
    company = _company(db, "ADVISORY")
    other = _company(db, "ADVISORY2")
    third = _company(db, "UNAUTHORIZED")
    role = db.query(Role).filter_by(name="external_portal").one()
    accountant, headers = _headers(db, company, role.id, "advisor")
    for target in (company, other):
        grant = ExternalAccessGrant(company_id=target.id,user_id=accountant.id,access_type="accountant",status="active")
        db.add(grant); db.flush()
        db.add(AdvisoryAccess(grant_id=grant.id,accounting=False,payroll=True))
    db.commit()
    base = "/api/v1/advisory"
    assert {r["id"] for r in client.get(base+"/companies",headers=headers).json()} == {company.id,other.id}
    assert client.get(f"{base}/{other.id}/payroll?month=2026-11",headers=headers).status_code == 200
    assert client.get(f"{base}/{third.id}/payroll?month=2026-11",headers=headers).status_code == 403
    assert client.get(f"{base}/{company.id}/accounting?year=2026",headers=headers).status_code == 403
    assert client.get("/api/v1/staff",headers=headers).status_code == 403
    owner = _bootstrap_admin(db,company,"advisory-owner")
    assert client.put(base+"/grants",headers=admin_headers(owner),json={"email":accountant.email,"accounting":True,"payroll":False}).status_code == 200
    assert client.get(f"{base}/{company.id}/payroll?month=2026-11",headers=headers).status_code == 403
    assert client.get(f"{base}/{company.id}/accounting?year=2026",headers=headers).status_code == 200
