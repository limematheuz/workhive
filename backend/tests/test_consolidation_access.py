from datetime import datetime, timezone
from sqlalchemy import event
from app.models.company_hierarchy import CompanyHierarchy
from app.models.company_membership import CompanyMembership
from app.models.expense import Expense
from app.models.permission_profile import PermissionProfile, PermissionDefinition, PermissionProfilePermission, MembershipPermissionProfileAssignment, MembershipPermissionProfileScope
from app.models.staff_employee import StaffEmployee
from app.models.subscription_entitlement import CompanyEntitlementOverride
from app.repositories import consolidation as repository
from tests.test_client_permission_authorization import _company, _bootstrap_admin, _headers, _user

BASE = "/api/v1/consolidation"


def _feature(db, company, enabled):
    row = db.query(CompanyEntitlementOverride).filter_by(company_id=company.id, code="features.corporate_structure").first()
    if row is None:
        row = CompanyEntitlementOverride(company_id=company.id, code="features.corporate_structure", value_type="boolean", reason="Consolidation access regression")
    row.boolean_value = enabled
    db.add(row); db.commit()


def _grant(db, company, user, codes, suffix):
    membership = CompanyMembership(company_id=company.id, user_id=user.id, access_class="responsible", status="active", permissions_configured=True)
    profile = PermissionProfile(company_id=company.id, name="Finance " + suffix, is_system=False, is_active=True)
    db.add_all([membership, profile]); db.flush()
    definitions = db.query(PermissionDefinition).filter(PermissionDefinition.code.in_(codes)).all()
    assert {definition.code for definition in definitions} == codes
    db.add_all([PermissionProfilePermission(permission_profile_id=profile.id, permission_definition_id=definition.id) for definition in definitions])
    assignment = MembershipPermissionProfileAssignment(company_id=company.id, company_membership_id=membership.id, permission_profile_id=profile.id, is_active=True)
    db.add(assignment); db.flush()
    db.add(MembershipPermissionProfileScope(company_id=company.id, profile_assignment_id=assignment.id, scope_type="company", scope_id=company.id)); db.commit()
    return membership


def _setup(db, suffix):
    company = _company(db, suffix)
    admin = _bootstrap_admin(db, company, suffix + "-admin")
    return company, admin


def _report(client, user, companies):
    return client.post(BASE + "/report", headers=_headers(user), json={"companies":companies, "reference_date":"2026-11-17", "currency":"EUR", "eur_rate":"1"})


def test_current_company_module_off_denies_listing_and_report_after_membership_authorization(client, db):
    company, admin = _setup(db, "consolidation-off")
    _feature(db, company, False)
    for result in (client.get(BASE + "/companies", headers=_headers(admin)), _report(client, admin, [company.id])):
        assert result.status_code == 403, result.text
        assert result.headers.get("X-WorkHive-Error-Code") == "entitlement.feature_not_in_plan"
    unprivileged = _user(db, company, "consolidation-no-finance", 3)
    db.add(CompanyMembership(company_id=company.id, user_id=unprivileged.id, access_class="worker", status="active", permissions_configured=True)); db.commit()
    denied = client.get(BASE + "/companies", headers=_headers(unprivileged))
    assert denied.status_code == 403
    assert "X-WorkHive-Error-Code" not in denied.headers


def test_finance_profile_can_report_its_only_company_without_admin_or_labor_permission(client, db):
    company, _ = _setup(db, "consolidation-finance")
    _feature(db, company, True)
    finance = _user(db, company, "consolidation-financial-reader", 3)
    membership = _grant(db, company, finance, {"finance.read"}, "own")
    assert membership.access_class != "admin"
    db.add(Expense(company_id=company.id, expense_date=datetime(2026,11,15,tzinfo=timezone.utc), category="Material", description="Consumible", base_amount=17, tax_amount=0, total_amount=17))
    db.add(StaffEmployee(company_id=company.id, name="Private employee", position="Limpieza", team="Equipo", monthly_hours=160, hourly_cost=999, profile={"gross":"987654"})); db.commit()
    listed = client.get(BASE + "/companies", headers=_headers(finance))
    assert listed.status_code == 200, listed.text
    assert [item["id"] for item in listed.json()] == [company.id]
    reported = _report(client, finance, [company.id])
    assert reported.status_code == 200, reported.text
    assert float(reported.json()["cost"]) == 17
    assert "987654" not in reported.text and "Private employee" not in reported.text


def test_multi_company_filter_checks_each_membership_permission_feature_and_hides_foreign_parent(client, db):
    current, _ = _setup(db, "consolidation-primary")
    finance = _user(db, current, "consolidation-multi-reader", 3)
    _feature(db, current, True)
    _grant(db, current, finance, {"finance.read"}, "primary")
    allowed, _ = _setup(db, "consolidation-authorized")
    disabled, _ = _setup(db, "consolidation-disabled")
    denied, _ = _setup(db, "consolidation-wrong-permission")
    suspended, _ = _setup(db, "consolidation-suspended")
    outsider, _ = _setup(db, "consolidation-outsider")
    for company in (allowed, denied, suspended, outsider):
        _feature(db, company, True)
    _feature(db, disabled, False)
    _grant(db, allowed, finance, {"finance.read"}, "allowed")
    _grant(db, disabled, finance, {"finance.read"}, "disabled")
    _grant(db, denied, finance, {"clients.read"}, "denied")
    membership = _grant(db, suspended, finance, {"finance.read"}, "suspended")
    membership.status = "suspended"
    db.add(CompanyHierarchy(company_id=current.id, parent_company_id=outsider.id)); db.commit()
    listed = client.get(BASE + "/companies", headers=_headers(finance))
    assert listed.status_code == 200, listed.text
    assert {item["id"] for item in listed.json()} == {current.id, allowed.id}
    assert next(item for item in listed.json() if item["id"] == current.id)["parent_company_id"] is None
    for company in (disabled, denied, suspended, outsider):
        assert company.name not in listed.text
        assert _report(client, finance, [current.id, company.id]).status_code == 403
    valid = _report(client, finance, [current.id, allowed.id, allowed.id])
    assert valid.status_code == 200, valid.text
    assert {item["company_id"] for item in valid.json()["companies"]} == {current.id, allowed.id}


def test_external_roles_and_revoked_memberships_cannot_use_internal_consolidation(client, db):
    company, _ = _setup(db, "consolidation-internal")
    _feature(db, company, True)
    for role in (5, 6, 7):
        external = _user(db, company, "consolidation-external-" + str(role), role); db.commit()
        assert client.get(BASE + "/companies", headers=_headers(external)).status_code == 403
        assert _report(client, external, [company.id]).status_code == 403
    finance = _user(db, company, "consolidation-revoked", 3)
    membership = _grant(db, company, finance, {"finance.read"}, "revoked")
    membership.status = "archived"; db.commit()
    assert client.get(BASE + "/companies", headers=_headers(finance)).status_code == 403


def test_company_and_metadata_queries_are_fixed_count_for_multiple_memberships(db):
    company, admin = _setup(db, "consolidation-query")
    for index in range(12):
        candidate = _company(db, "consolidation-batch-" + str(index))
        db.add(CompanyMembership(company_id=candidate.id, user_id=admin.id, access_class="responsible", status="active"))
    db.commit()
    user_id = admin.id
    statements = []
    def count(conn, cursor, statement, parameters, context, many):
        statements.append(statement)
    event.listen(db.bind, "before_cursor_execute", count)
    try:
        candidates = repository.companies(db, type("Principal", (), {"id":user_id})())
        repository.metadata(db, [item.id for item in candidates])
    finally:
        event.remove(db.bind, "before_cursor_execute", count)
    assert len(candidates) == 13
    assert len(statements) == 3
