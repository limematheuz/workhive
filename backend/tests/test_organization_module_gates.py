"""Module availability and canonical permissions must both authorize a mutation."""
import pytest
from app.services.organization_membership_lifecycle import sync_administrator_profile
from app.models.company_membership import CompanyMembership, Department
from app.models.company_hierarchy import CompanyHierarchy
from app.models.staff_employee import StaffEmployee
from app.models.subscription_entitlement import CompanyEntitlementOverride
from tests.test_client_permission_authorization import _company, _bootstrap_admin, _headers, _user, _assign_company_profile


def _module(db, company, code, enabled):
    row = db.query(CompanyEntitlementOverride).filter_by(company_id=company.id, code=code).first()
    if row is None:
        row = CompanyEntitlementOverride(company_id=company.id, code=code, value_type="boolean", reason="Module gate regression")
    row.boolean_value = enabled
    db.add(row); db.commit()


def _setup(db, suffix):
    company = _company(db, suffix)
    admin = _bootstrap_admin(db, company, suffix + "-admin")
    return company, admin, _headers(admin)


def _branch(db, company):
    row = Department(company_id=company.id, name="Delegación Norte", normalized_name="delegación norte", unit_type="branch")
    db.add(row); db.commit()
    return row


def test_branch_module_off_denies_create_and_implicit_or_explicit_branch_update(client, db):
    company, _, headers = _setup(db, "branch-denied")
    existing = _branch(db, company)
    _module(db, company, "features.branches", False)
    created = client.post("/api/v1/organization/departments", headers=headers, json={"name":"Sur", "unit_type":"branch"})
    assert created.status_code == 403, created.text
    for payload in ({"name":"Nombre cambiado"}, {"code":"NEW"}, {"is_active":False}, {"name":"Otra delegación", "unit_type":"branch"}):
        changed = client.patch(f"/api/v1/organization/departments/{existing.id}", headers=headers, json=payload)
        assert changed.status_code == 403, changed.text
        db.refresh(existing)
        assert existing.name == "Delegación Norte" and existing.code is None and existing.is_active


def test_branch_can_be_explicitly_converted_to_area_when_branch_module_is_off(client, db):
    company, _, headers = _setup(db, "branch-conversion")
    existing = _branch(db, company)
    _module(db, company, "features.branches", False)
    converted = client.patch(f"/api/v1/organization/departments/{existing.id}", headers=headers, json={"unit_type":"area", "name":"Operaciones Norte"})
    assert converted.status_code == 200, converted.text
    assert converted.json()["unit_type"] == "area"
    assert client.patch(f"/api/v1/organization/departments/{existing.id}", headers=headers, json={"code":"OPS"}).status_code == 200
    assert client.post("/api/v1/organization/departments", headers=headers, json={"name":"Administración"}).status_code == 201
    denied = client.patch(f"/api/v1/organization/departments/{existing.id}", headers=headers, json={"unit_type":"branch"})
    assert denied.status_code == 403, denied.text
    db.refresh(existing)
    assert existing.unit_type == "area"


def test_enabled_branch_module_preserves_type_on_partial_updates_and_company_scope(client, db):
    company, _, headers = _setup(db, "branch-enabled")
    _module(db, company, "features.branches", True)
    created = client.post("/api/v1/organization/departments", headers=headers, json={"name":"Madrid", "unit_type":"branch"})
    assert created.status_code == 201, created.text
    identifier = created.json()["id"]
    updated = client.patch(f"/api/v1/organization/departments/{identifier}", headers=headers, json={"code":"MAD"})
    assert updated.status_code == 200, updated.text
    assert updated.json()["unit_type"] == "branch" and updated.json()["code"] == "MAD"
    outside, _, _ = _setup(db, "branch-foreign")
    foreign = _branch(db, outside)
    assert client.patch(f"/api/v1/organization/departments/{foreign.id}", headers=headers, json={"unit_type":"area"}).status_code == 404


def test_organization_module_off_denies_area_reads_creates_and_updates(client, db):
    company, _, headers = _setup(db, "organization-off")
    existing = _branch(db, company)
    _module(db, company, "features.branches", True)
    _module(db, company, "features.organization", False)
    assert client.get("/api/v1/organization/departments", headers=headers).status_code == 403
    for kind in ("area", "branch"):
        assert client.post("/api/v1/organization/departments", headers=headers, json={"name":"No permitido " + kind, "unit_type":kind}).status_code == 403
        assert client.patch(f"/api/v1/organization/departments/{existing.id}", headers=headers, json={"unit_type":kind}).status_code == 403
    assert client.delete(f"/api/v1/organization/departments/{existing.id}", headers=headers).status_code == 403


@pytest.mark.parametrize("path", ["/api/v1/staff", "/api/v1/staff-shifts", "/api/v1/staff-absences"])
def test_hr_module_off_denies_labor_reads_even_to_admins(client, db, path):
    company, _, headers = _setup(db, "hr-off-" + path.rsplit("/",1)[1])
    _module(db, company, "features.hr", False)
    response = client.get(path, headers=headers)
    assert response.status_code == 403, response.text


def test_hr_module_and_permission_are_both_required_for_staff_mutations(client, db):
    company, admin, headers = _setup(db, "hr-write-gate")
    payload = {"name":"No guardar", "position":"Limpieza", "team":"Norte", "monthly_hours":"160", "hourly_cost":"15", "profile":{}}
    _module(db, company, "features.hr", False)
    denied = client.post("/api/v1/staff", headers=headers, json=payload)
    assert denied.status_code == 403, denied.text
    assert db.query(StaffEmployee).filter_by(company_id=company.id).count() == 0
    _module(db, company, "features.hr", True)
    reader = _user(db, company, "hr-unprivileged", 3)
    _assign_company_profile(db, company=company, admin=admin, user=reader, name="Solo clientes", permission_codes={"clients.read"})
    assert client.get("/api/v1/staff", headers=_headers(reader)).status_code == 403
    assert client.post("/api/v1/staff", headers=_headers(reader), json=payload).status_code == 403
    allowed = client.post("/api/v1/staff", headers=headers, json=payload)
    assert allowed.status_code == 201, allowed.text


def test_corporate_parent_requires_enabled_module_for_both_authorized_companies(client, db):
    child, admin, headers = _setup(db, "corporate-child")
    parent = _company(db, "corporate-parent")
    membership=CompanyMembership(company_id=parent.id,user_id=admin.id,access_class="admin",status="active");db.add(membership);db.flush()
    sync_administrator_profile(db,membership,actor_id=admin.id);db.commit()
    settings = {"country":"ES", "timezone":"Europe/Madrid", "language":"es", "parent_company_id":parent.id}
    for child_enabled, parent_enabled in ((False,True), (True,False)):
        _module(db, child, "features.corporate_structure", child_enabled)
        _module(db, parent, "features.corporate_structure", parent_enabled)
        denied = client.put("/api/v1/consolidation/settings", headers=headers, json=settings)
        assert denied.status_code == 403, denied.text
        assert db.query(CompanyHierarchy).filter_by(company_id=child.id).first() is None
    _module(db, child, "features.corporate_structure", True)
    _module(db, parent, "features.corporate_structure", True)
    allowed = client.put("/api/v1/consolidation/settings", headers=headers, json=settings)
    assert allowed.status_code == 200, allowed.text
    assert allowed.json()["parent_company_id"] == parent.id
    outsider = _company(db, "corporate-outsider")
    _module(db, outsider, "features.corporate_structure", True)
    denied = client.put("/api/v1/consolidation/settings", headers=headers, json={**settings, "parent_company_id":outsider.id})
    assert denied.status_code == 403, denied.text
    db.expire_all()
    assert db.query(CompanyHierarchy).filter_by(company_id=child.id).one().parent_company_id == parent.id
