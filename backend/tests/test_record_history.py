from datetime import datetime, timezone
from sqlalchemy import event, inspect
from app.db.base import Base
from app.models.audit_log import AuditLog
from app.models.client import Client
from app.models.company_membership import CompanyMembership
from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.location import Location
from app.models.permission_profile import PermissionProfile
from app.models.staff_employee import StaffEmployee
from app.models.subscription_entitlement import CompanyEntitlementOverride
from app.models.task_item import TaskItem
from app.repositories import record_history as history_repo
from app.services.record_history_capture import bind_actor, clear_actor
from app.services.record_history_catalog import TRACKED
from tests.test_client_permission_authorization import _company, _bootstrap_admin, _user, _headers, _client, _assign_company_profile


def _setup(db, suffix):
    company = _company(db, suffix)
    return company, _bootstrap_admin(db, company, suffix + "-admin")


def _history(client, user, kind, identifier, suffix=""):
    return client.get(f"/api/v1/record-history/{kind}/{identifier}{suffix}", headers=_headers(user))


def test_catalog_fields_are_real_scalar_attributes():
    models = {mapper.class_.__tablename__: mapper for mapper in Base.registry.mappers}
    for table, (_, fields) in TRACKED.items():
        assert table in models
        assert set(fields).issubset(models[table].column_attrs.keys()), table


def test_authenticated_client_change_records_actor_values_and_rejects_foreign_company(client, db):
    company, admin = _setup(db, "history-api")
    account = _client(db, company, "Antes")
    changed = client.patch(f"/api/v1/clients/{account.id}", headers=_headers(admin), json={"name":"Después", "address":"Dato privado"})
    assert changed.status_code == 200, changed.text
    result = _history(client, admin, "client", account.id)
    assert result.status_code == 200, result.text
    item = next(item for item in result.json()["items"] if item["changes"])
    assert item["actor_name"] == admin.full_name
    assert item["occurred_at"].endswith("Z")
    name = next(change for change in item["changes"] if change["field"] == "name")
    assert (name["before"], name["after"], name["before_known"]) == ("Antes", "Después", True)
    assert "Dato privado" not in result.text
    _, other = _setup(db, "history-other")
    assert _history(client, other, "client", account.id).status_code == 404
    for role in (5, 6, 7):
        portal = _user(db, company, "portal-history-" + str(role), role)
        db.commit()
        assert _history(client, portal, "client", account.id).status_code == 403


def test_capture_batches_without_selects_and_rolls_back_atomically(db):
    company, admin = _setup(db, "history-batch")
    rows = [Client(company_id=company.id, name=f"Client {index}", address="Private", city="Madrid", country="España", postal_code="28001") for index in range(12)]
    db.add_all(rows); db.commit()
    for row in rows:
        inspect(row).attrs.name.value
        inspect(row).attrs.company_id.value
    bind_actor(db, admin)
    statements = []
    def record(conn, cursor, statement, parameters, context, many):
        statements.append(statement)
    event.listen(db.bind, "before_cursor_execute", record)
    try:
        for row in rows:
            row.name += " updated"
        db.flush()
    finally:
        event.remove(db.bind, "before_cursor_execute", record)
    assert not any(statement.lstrip().upper().startswith("SELECT") for statement in statements), statements
    assert sum("INSERT INTO audit_logs" in statement for statement in statements) == 1
    assert db.query(AuditLog).filter_by(company_id=company.id, entity_type="client").count() == 12
    db.rollback()
    assert db.query(AuditLog).filter_by(company_id=company.id, entity_type="client").count() == 0
    clear_actor(db)
    rows[0].name = "No authenticated actor"
    db.commit()
    assert db.query(AuditLog).filter_by(company_id=company.id, entity_type="client").count() == 0


def test_task_history_enforces_location_scope_and_redacts_costs_and_metadata(client, db):
    company, admin = _setup(db, "history-scope")
    sites = [Location(owner_company_id=company.id, name=name, address="Test", city="Madrid") for name in ("North", "South")]
    db.add_all(sites); db.flush()
    tasks = [TaskItem(company_id=company.id, location_id=site.id, title="Trabajo", unit="ud", status="accepted") for site in sites]
    db.add_all(tasks); db.commit()
    reader = _user(db, company, "history-operator", 3)
    _assign_company_profile(db, company=company, admin=admin, user=reader, name="History work", permission_codes={"work.read"}, scope_type="location", scope_id=sites[0].id)
    db.add(AuditLog(company_id=company.id, actor_user_id=admin.id, action="record.updated", entity_type="task_item", entity_id=str(tasks[0].id), ip_address="secret-ip", details={"token":"private-token", "changes":[{"field":"title", "before":"A", "after":"B", "before_known":True},{"field":"price", "after":999999},{"field":"profile.gross", "after":888888},{"field":"notes", "after":"Private note"}]})); db.commit()
    result = _history(client, reader, "task_item", tasks[0].id)
    assert result.status_code == 200, result.text
    assert [change["field"] for change in result.json()["items"][0]["changes"]] == ["title"]
    for private in ("secret-ip", "private-token", "Private note", "999999", "888888"):
        assert private not in result.text
    assert _history(client, reader, "task_item", tasks[1].id).status_code in (403, 404)


def test_finance_hr_and_access_history_require_respective_capabilities(client, db):
    company, admin = _setup(db, "history-domains")
    account = _client(db, company, "Cuenta")
    employee = StaffEmployee(company_id=company.id, name="Worker", position="Limpieza", team="Equipo", monthly_hours=160, hourly_cost=15, profile={})
    expense = Expense(company_id=company.id, expense_date=datetime.now(timezone.utc), category="Material", description="Compra", total_amount=20)
    invoice = Invoice(company_id=company.id, client_id=account.id, invoice_number="TEST-1", issue_date=datetime.now(timezone.utc))
    db.add_all([employee, expense, invoice]); db.commit()
    membership = db.query(CompanyMembership).filter_by(user_id=admin.id, company_id=company.id).one()
    profile = db.query(PermissionProfile).filter_by(company_id=company.id).first()
    reader = _user(db, company, "history-client-only", 3)
    _assign_company_profile(db, company=company, admin=admin, user=reader, name="History customers only", permission_codes={"clients.read"})
    for kind, identifier in (("staff_employee",employee.id),("expense",expense.id),("invoice",invoice.id),("company_membership",membership.id),("permission_profile",profile.id)):
        assert _history(client, reader, kind, identifier).status_code == 403
        allowed = _history(client, admin, kind, identifier)
        assert allowed.status_code == 200, (kind, allowed.text)
    # Expenses are core finance; disabling invoicing must not hide their own audit.
    db.add(CompanyEntitlementOverride(company_id=company.id, code="features.invoices", value_type="boolean", boolean_value=False, reason="History feature regression")); db.commit()
    assert _history(client, admin, "expense", expense.id).status_code == 200
    assert _history(client, admin, "invoice", invoice.id).status_code == 403


def test_permission_edits_record_exact_codes_and_assigned_scopes(client, db):
    company, admin = _setup(db, "history-permissions")
    created = client.post("/api/v1/organization/permission-profiles", headers=_headers(admin), json={"name":"Consulta historial", "permission_codes":["clients.read"]})
    assert created.status_code == 201, created.text
    profile_id = created.json()["id"]
    changed = client.patch(f"/api/v1/organization/permission-profiles/{profile_id}", headers=_headers(admin), json={"permission_codes":["clients.read","work.read"]})
    assert changed.status_code == 200, changed.text
    result = _history(client, admin, "permission_profile", profile_id)
    assert result.status_code == 200, result.text
    change = next(change for row in result.json()["items"] for change in row["changes"] if change["field"] == "permission_codes" and "work.read" in (change["after"] or ""))
    assert change["before"] == "clients.read" and change["after"] == "clients.read, work.read"
    user = _user(db, company, "history-assigned", 3)
    from app.services.organization_bootstrap_service import ensure_user_membership
    membership = ensure_user_membership(db, user); db.commit()
    assigned = client.put(f"/api/v1/organization/members/{membership.id}/profile-assignments", headers=_headers(admin), json={"assignments":[{"permission_profile_id":profile_id,"scopes":[{"scope_type":"company","scope_id":company.id}]}]})
    assert assigned.status_code == 200, assigned.text
    record = _history(client, admin, "company_membership", membership.id)
    assert record.status_code == 200, record.text
    assert any(change["field"] == "profile_assignments" and "Consulta historial" in (change["after"] or "") and f"company:{company.id}" in change["after"] for row in record.json()["items"] for change in row["changes"])


def test_history_query_is_bounded_and_unknown_types_offsets_rejected(client, db):
    company, admin = _setup(db, "history-pagination")
    account = _client(db, company, "Cuenta")
    clear_actor(db)
    db.add_all([AuditLog(company_id=company.id, actor_user_id=admin.id, action="record.updated", entity_type="client", entity_id=str(account.id), details={}) for _ in range(65)]); db.commit()
    company_id, account_id = company.id, account.id
    statements = []
    def record(conn, cursor, statement, parameters, context, many):
        statements.append(statement)
    event.listen(db.bind, "before_cursor_execute", record)
    try:
        rows = history_repo.events(db, company_id, "client", account_id, 0)
    finally:
        event.remove(db.bind, "before_cursor_execute", record)
    assert len(rows) == 51 and len(statements) == 1 and "LIMIT" in statements[0].upper()
    first = _history(client, admin, "client", account.id).json()
    second = _history(client, admin, "client", account.id, "?offset=50").json()
    assert len(first["items"]) == 50 and first["has_more"]
    assert len(second["items"]) == 15 and not second["has_more"]
    assert not set(item["id"] for item in first["items"]).intersection(item["id"] for item in second["items"])
    assert _history(client, admin, "client", account.id, "?offset=-1").status_code == 422
    assert _history(client, admin, "password", account.id).status_code == 422


def test_employee_history_includes_own_schedule_while_job_history_excludes_absence_data(db):
    from datetime import timedelta
    from app.models.staff_shift import StaffShift
    from app.models.staff_absence import StaffAbsence
    company,admin=_setup(db,"history-staff-links")
    staff=StaffEmployee(company_id=company.id,name="Personal",position="Limpieza",team="",monthly_hours=160,hourly_cost=15,profile={})
    site=Location(name="Centro",address="Calle 1",city="Madrid",owner_company_id=company.id,managing_company_id=company.id)
    db.add_all([staff,site]);db.flush()
    task=TaskItem(company_id=company.id,location_id=site.id,title="Servicio",unit="service",quantity=1);db.add(task);db.flush()
    now=datetime.now(timezone.utc)
    shift=StaffShift(company_id=company.id,employee_id=staff.id,location_id=site.id,task_id=task.id,starts_at=now,ends_at=now+timedelta(hours=1))
    absence=StaffAbsence(company_id=company.id,employee_id=staff.id,starts_on=now.date(),ends_on=now.date(),kind="sick")
    db.add_all([shift,absence]);db.flush()
    events=[AuditLog(company_id=company.id,actor_user_id=admin.id,action="record.updated",entity_type=kind,entity_id=str(identifier),details={}) for kind,identifier in [("staff_shift",shift.id),("staff_absence",absence.id)]]
    db.add_all(events);db.commit()
    employee_events={row.entity_type for row,_ in history_repo.events(db,company.id,"staff_employee",staff.id,0)}
    assert {"staff_shift","staff_absence"}.issubset(employee_events)
    task_events={row.entity_type for row,_ in history_repo.events(db,company.id,"task_item",task.id,0)}
    assert "staff_shift" in task_events and "staff_absence" not in task_events
