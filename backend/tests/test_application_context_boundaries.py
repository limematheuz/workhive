"""Application selection preserves identity while narrowing each portal session."""
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.security import create_access_token
from app.models.advisory_access import AdvisoryAccess
from app.models.client_portal_grant import ClientPortalGrant
from app.models.company_membership import CompanyMembership
from app.models.external_access_grant import ExternalAccessGrant
from app.models.location import Location
from app.models.staff_account import StaffAccount
from app.models.staff_employee import StaffEmployee
from app.models.work_session import WorkSession
from tests.test_client_permission_authorization import _bootstrap_admin, _headers
from tests.test_client_portal_api import _client, _company


@pytest.mark.parametrize("kind", [None, "", True, 0, [], {}, "superadmin"])
def test_malformed_application_kind_is_rejected_without_falling_back_to_internal_identity(kind):
    from app.services.session_token_claims import session_claims
    token = create_access_token({"sub": "application-person@example.com", "ver": 0, "application_kind": kind})
    with pytest.raises(HTTPException) as raised:
        session_claims(token, None)
    assert raised.value.status_code == 401


@pytest.fixture
def application_world(db):
    first = _company(db, "application-boundary-one")
    second = _company(db, "application-boundary-two")
    person = _bootstrap_admin(db, first, "application-person")
    other = _bootstrap_admin(db, second, "application-other")
    outsider = _bootstrap_admin(db, first, "application-outsider")
    person.email = "application-person@example.com"
    other.email = "application-other@example.com"
    outsider.email = "application-outsider@example.com"
    grants, advisers = [], []
    for index, company in enumerate((first, second), 1):
        customer = _client(db, company=company, suffix=f"application-customer-{index}")
        grant = ClientPortalGrant(
            company_id=company.id, client_id=customer.id, user_id=person.id,
            granted_by_user_id=other.id, status="active",
        )
        adviser = ExternalAccessGrant(
            company_id=company.id, user_id=person.id, access_type="accountant",
            granted_by_user_id=other.id, status="active",
        )
        db.add_all([grant, adviser])
        db.flush()
        db.add(AdvisoryAccess(grant_id=adviser.id, accounting=True, payroll=True))
        grants.append(grant)
        advisers.append(adviser)
    employee = StaffEmployee(
        company_id=first.id, name="Application employee", position="Cleaner",
        team="Application team", monthly_hours=160, hourly_cost=15,
        profile={"state": "Activo", "account_email": person.email}, history={},
    )
    location = Location(
        name="Application location", address="Test address", city="Madrid",
        owner_company_id=first.id, managing_company_id=first.id,
    )
    db.add_all([employee, location])
    db.flush()
    db.add(StaffAccount(employee_id=employee.id, company_id=first.id, user_id=person.id))
    db.commit()
    return dict(first=first, second=second, person=person, other=other, outsider=outsider,
                clients=grants, advisers=advisers, employee=employee, location=location)


def _options(client, person):
    response = client.get("/api/v1/session/applications", headers=_headers(person))
    assert response.status_code == 200, response.text
    return response.json()["applications"]


def _switch(client, person, kind):
    entry = next(row for row in _options(client, person) if row["kind"] == kind)
    response = client.post(
        "/api/v1/session/applications/switch", headers=_headers(person), json={"key": entry["key"]},
    )
    assert response.status_code == 200, response.text
    return response.json(), {"Authorization": "Bearer " + response.json()["access_token"]}


@pytest.mark.parametrize("kind,role", [("client", "client_portal"), ("adviser", "external_portal")])
def test_portal_context_never_reuses_the_durable_administrator_authority(client, db, application_world, kind, role):
    world = application_world
    person = world["person"]
    original = (person.company_id, person.role_id, person.session_version)
    internal_headers = _headers(person)
    assert client.get("/api/v1/staff", headers=internal_headers).status_code == 200
    result, headers = _switch(client, person, kind)
    assert result["application"]["kind"] == kind
    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["id"] == person.id
    assert me.json()["role"]["name"] == role
    assert me.json()["company_id"] is None
    assert me.json()["can_manage_finance"] is False
    assert me.json()["can_manage_labor_costs"] is False
    assert me.json()["active_location_id"] is None
    for path in ("/api/v1/staff", "/api/v1/invoices/", "/api/v1/users/"):
        assert client.get(path, headers=headers).status_code in (400, 403), path
    db.refresh(person)
    assert (person.company_id, person.role_id, person.session_version) == original
    assert person.role.name == "admin"
    assert client.get("/api/v1/staff", headers=internal_headers).status_code == 200


def test_client_session_is_bound_to_one_grant_even_when_the_identity_owns_another(client, application_world):
    _, headers = _switch(client, application_world["person"], "client")
    response = client.get("/api/v1/client-portal/workspaces", headers=headers)
    assert response.status_code == 200, response.text
    assert len(response.json()) == 1
    selected = response.json()[0]["id"]
    for grant in application_world["clients"]:
        response = client.get(f"/api/v1/client-portal/workspaces/{grant.id}/overview", headers=headers)
        assert response.status_code == (200 if grant.id == selected else 403), response.text


def test_adviser_session_is_bound_to_one_grant_and_keeps_internal_staff_private(client, application_world):
    _, headers = _switch(client, application_world["person"], "adviser")
    response = client.get("/api/v1/advisory/companies", headers=headers)
    assert response.status_code == 200, response.text
    assert len(response.json()) == 1
    selected = response.json()[0]["id"]
    for company in (application_world["first"], application_world["second"]):
        response = client.get(f"/api/v1/advisory/{company.id}/payroll", headers=headers, params={"month": "2026-11"})
        assert response.status_code == (200 if company.id == selected else 403), response.text
    assert client.get("/api/v1/staff", headers=headers).status_code in (400, 403)


@pytest.mark.parametrize("kind", ["client", "adviser"])
def test_portal_claims_cannot_be_combined_with_internal_company_claims(client, application_world, kind):
    switched, _ = _switch(client, application_world["person"], kind)
    claims = jwt.decode(switched["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    claims.update(company_id=application_world["first"].id, membership_version=0)
    headers = {"Authorization": "Bearer " + create_access_token(claims)}
    for path in ("/api/v1/users/me", "/api/v1/staff"):
        assert client.get(path, headers=headers).status_code == 401, path


def test_portal_claims_require_a_recognized_application_and_the_grant_epoch(client, application_world):
    switched, _ = _switch(client, application_world["person"], "client")
    original = jwt.decode(switched["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    changes = [
        {"application_kind": "superadmin"}, {"application_kind": []},
        {"application_grant_id": False}, {"application_grant_id": 0},
        {"application_grant_version": None}, {"application_grant_version": True},
    ]
    for change in changes:
        token = create_access_token({**original, **change})
        headers = {"Authorization": "Bearer " + token}
        for path in ("/api/v1/users/me", "/api/v1/staff"):
            assert client.get(path, headers=headers).status_code == 401, (change, path)
    without_epoch = {key: value for key, value in original.items() if key != "application_grant_version"}
    headers = {"Authorization": "Bearer " + create_access_token(without_epoch)}
    assert client.get("/api/v1/users/me", headers=headers).status_code == 401


@pytest.mark.parametrize("kind", ["client", "adviser"])
def test_another_identity_cannot_select_somebody_elses_portal_key(client, application_world, kind):
    person, outsider = application_world["person"], application_world["outsider"]
    entry = next(row for row in _options(client, person) if row["kind"] == kind)
    assert kind not in {row["kind"] for row in _options(client, outsider)}
    response = client.post(
        "/api/v1/session/applications/switch", headers=_headers(outsider), json={"key": entry["key"]},
    )
    assert response.status_code == 403, response.text


def test_internal_application_key_still_requires_its_actual_membership(client, application_world):
    world = application_world
    entry = next(row for row in _options(client, world["other"]) if row["kind"] == "internal")
    response = client.post(
        "/api/v1/session/applications/switch", headers=_headers(world["person"]), json={"key": entry["key"]},
    )
    assert response.status_code == 403, response.text


def test_returning_from_portal_to_worker_or_internal_keeps_the_same_person(client, db, application_world):
    world = application_world
    _, portal_headers = _switch(client, world["person"], "client")
    entries = client.get("/api/v1/session/applications", headers=portal_headers)
    assert entries.status_code == 200, entries.text
    assert entries.json()["current_application"] == "client"
    for kind in ("worker", "internal"):
        entry = next(row for row in entries.json()["applications"] if row["kind"] == kind)
        switched = client.post("/api/v1/session/applications/switch", headers=portal_headers, json={"key": entry["key"]})
        assert switched.status_code == 200, switched.text
        headers = {"Authorization": "Bearer " + switched.json()["access_token"]}
        me = client.get("/api/v1/users/me", headers=headers)
        assert me.status_code == 200, me.text
        assert me.json()["id"] == world["person"].id
        assert me.json()["company_id"] == world["first"].id
        assert me.json()["role"]["name"] == "admin"
        assert client.get("/api/v1/session/applications", headers=headers).json()["current_application"] == kind
    db.refresh(world["person"])
    assert world["person"].role.name == "admin"


def test_portal_session_cannot_restore_a_suspended_internal_membership(client, db, application_world):
    world = application_world
    entry = next(row for row in _options(client, world["person"]) if row["kind"] == "internal")
    original_internal = _headers(world["person"])
    _, portal_headers = _switch(client, world["person"], "client")
    membership = db.query(CompanyMembership).filter_by(user_id=world["person"].id, company_id=world["first"].id).one()
    membership.status = "suspended"
    db.commit()
    assert client.get("/api/v1/users/me", headers=portal_headers).status_code == 200
    choices = client.get("/api/v1/session/applications", headers=portal_headers)
    assert choices.status_code == 200, choices.text
    assert entry["key"] not in {row["key"] for row in choices.json()["applications"]}
    response = client.post("/api/v1/session/applications/switch", headers=portal_headers, json={"key": entry["key"]})
    assert response.status_code == 403, response.text
    membership.status = "active"
    db.commit()
    assert client.get("/api/v1/users/me", headers=original_internal).status_code == 401
    fresh = client.post("/api/v1/session/applications/switch", headers=portal_headers, json={"key": entry["key"]})
    assert fresh.status_code == 200, fresh.text


@pytest.mark.parametrize("kind", ["client", "adviser"])
def test_revocation_and_reactivation_never_revive_a_portal_session(client, db, application_world, kind):
    world = application_world
    switched, headers = _switch(client, world["person"], kind)
    claims = jwt.decode(switched["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    grants = world["clients"] if kind == "client" else world["advisers"]
    grant = next(row for row in grants if row.id == claims["application_grant_id"])
    original_epoch = grant.session_version
    grant.status, grant.revoked_at = "revoked", datetime.now(timezone.utc)
    db.commit()
    assert client.get("/api/v1/users/me", headers=headers).status_code in (401, 403)
    grant.status, grant.revoked_at = "active", None
    db.commit()
    assert grant.session_version > original_epoch
    assert client.get("/api/v1/users/me", headers=headers).status_code == 401
    _, fresh = _switch(client, world["person"], kind)
    assert client.get("/api/v1/users/me", headers=fresh).status_code == 200


@pytest.mark.parametrize("kind", ["client", "adviser"])
def test_grant_expiry_invalidates_an_already_issued_portal_session(client, db, application_world, kind):
    world = application_world
    switched, headers = _switch(client, world["person"], kind)
    claims = jwt.decode(switched["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    grants = world["clients"] if kind == "client" else world["advisers"]
    grant = next(row for row in grants if row.id == claims["application_grant_id"])
    grant.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()
    assert client.get("/api/v1/users/me", headers=headers).status_code in (401, 403)


def test_portal_identity_does_not_expose_an_internal_shift_started_elsewhere(client, db, application_world):
    world = application_world
    _, headers = _switch(client, world["person"], "client")
    shift = WorkSession(
        user_id=world["person"].id, company_id=world["first"].id,
        location_id=world["location"].id, start_time=datetime.now(timezone.utc),
    )
    db.add(shift)
    db.commit()
    response = client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["active_location_id"] is None
    assert response.json()["active_location_name"] is None
    assert client.post("/api/v1/work-sessions/stop", headers=headers).status_code in (400, 403)
    db.refresh(shift)
    assert shift.end_time is None


def test_logout_from_portal_revokes_the_same_identitys_internal_and_portal_sessions(client, db, application_world):
    world = application_world
    original_headers = _headers(world["person"])
    _, portal_headers = _switch(client, world["person"], "client")
    version = world["person"].session_version
    response = client.post("/api/v1/auth/logout", headers=portal_headers)
    assert response.status_code == 204, response.text
    db.refresh(world["person"])
    assert world["person"].session_version == version + 1
    assert world["person"].company_id == world["first"].id
    assert world["person"].role.name == "admin"
    for headers in (original_headers, portal_headers):
        assert client.get("/api/v1/users/me", headers=headers).status_code == 401
