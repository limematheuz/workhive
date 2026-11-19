"""Application selection follows real grants, feature state and revocation epochs."""
from sqlalchemy import event
from app.core.config import settings
from app.models.advisory_access import AdvisoryAccess
from app.models.client_portal_grant import ClientPortalGrant
from app.models.staff_account import StaffAccount
from app.models.subscription_entitlement import CompanyEntitlementOverride
from tests.test_application_context_boundaries import application_world, _options, _switch
from tests.test_client_permission_authorization import _headers


def disable(db, company, code):
    db.add(CompanyEntitlementOverride(company_id=company.id, code=code, value_type="boolean",
        boolean_value=False, reason="Application access regression"))
    db.commit()


def test_advisory_area_changes_revoke_old_portal_tokens_without_touching_company_sessions(client, db, application_world):
    world = application_world
    person = world["person"]
    _, token = _switch(client, person, "adviser")
    grant = world["advisers"][0]
    area = db.get(AdvisoryAccess, grant.id)
    epoch, identity_epoch = grant.session_version, person.session_version
    area.accounting = False
    db.commit()
    db.refresh(grant)
    assert grant.session_version > epoch
    assert client.get("/api/v1/users/me", headers=token).status_code == 401
    assert client.get("/api/v1/users/me", headers=_headers(person)).status_code == 200
    area.accounting = True
    db.commit()
    assert client.get("/api/v1/users/me", headers=token).status_code == 401
    db.refresh(person)
    assert person.session_version == identity_epoch
    _, fresh = _switch(client, person, "adviser")
    assert client.get("/api/v1/users/me", headers=fresh).status_code == 200


def test_removed_employee_link_invalidates_worker_context_only(client, db, application_world):
    world = application_world
    _, token = _switch(client, world["person"], "worker")
    db.delete(db.get(StaffAccount, world["employee"].id))
    db.commit()
    assert "worker" not in {row["kind"] for row in _options(client, world["person"])}
    assert client.get("/api/v1/users/me", headers=token).status_code == 401
    assert client.get("/api/v1/users/me", headers=_headers(world["person"])).status_code == 200


def test_plan_module_revocation_removes_and_invalidates_worker_application(client, db, application_world):
    world = application_world
    _, token = _switch(client, world["person"], "worker")
    disable(db, world["first"], "features.work_orders")
    assert "worker" not in {row["kind"] for row in _options(client, world["person"])}
    assert client.get("/api/v1/users/me", headers=token).status_code == 401


def test_payroll_only_context_disappears_when_hr_module_is_disabled(client, db, application_world):
    world = application_world
    area = db.get(AdvisoryAccess, world["advisers"][0].id)
    area.accounting = False
    db.commit()
    switched, token = _switch(client, world["person"], "adviser")
    assert switched["application"]["company_id"] == world["first"].id
    disable(db, world["first"], "features.hr")
    assert not any(row["kind"] == "adviser" and row["company_id"] == world["first"].id
        for row in _options(client, world["person"]))
    assert client.get("/api/v1/users/me", headers=token).status_code == 401


def test_cookie_application_switch_requires_csrf_and_rotates_session_cookies(client, application_world):
    person = application_world["person"]
    target = next(row for row in _options(client, person) if row["kind"] == "client")
    token = _headers(person)["Authorization"].split(" ", 1)[1]
    csrf = "application-csrf-test-token-unique"
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)
    client.cookies.set(settings.CSRF_COOKIE_NAME, csrf)
    assert client.post("/api/v1/session/applications/switch", json={"key":target["key"]}).status_code == 403
    response = client.post("/api/v1/session/applications/switch", headers={"X-CSRF-Token":csrf}, json={"key":target["key"]})
    assert response.status_code == 200, response.text
    assert response.json()["csrf_token"] != csrf
    cookies = response.headers.get_list("set-cookie")
    assert any(settings.SESSION_COOKIE_NAME + "=" in cookie and "HttpOnly" in cookie for cookie in cookies)


def test_many_same_company_portal_grants_do_not_add_one_query_per_relationship(client, db, application_world):
    world = application_world
    def reads():
        queries = []
        def count(connection, cursor, statement, parameters, context, many):
            if statement.lstrip().upper().startswith("SELECT"):
                queries.append(statement)
        engine = db.get_bind()
        event.listen(engine, "before_cursor_execute", count)
        try:
            rows = _options(client, world["person"])
        finally:
            event.remove(engine, "before_cursor_execute", count)
        return len(queries), rows
    initial, _ = reads()
    from tests.test_client_portal_api import _client
    for index in range(12):
        customer = _client(db, company=world["first"], suffix=f"many-application-grants-{index}")
        db.add(ClientPortalGrant(company_id=world["first"].id, client_id=customer.id,
            user_id=world["person"].id, status="active"))
    db.commit()
    final, rows = reads()
    assert len([row for row in rows if row["kind"] == "client"]) == 14
    assert final <= initial + 1


def test_revoked_portal_context_can_still_log_out_the_durable_identity(client, db, application_world):
    world = application_world
    _, token = _switch(client, world["person"], "client")
    world["clients"][0].status = "revoked"
    db.commit()
    assert client.get("/api/v1/users/me", headers=token).status_code == 401
    assert client.post("/api/v1/auth/logout", headers=token).status_code == 204
    assert client.get("/api/v1/session/applications", headers=token).status_code == 401
