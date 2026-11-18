"""Invitation consent and company-local membership changes preserve identity."""

import json
from urllib.parse import parse_qs, urlparse

from app.core.config import settings
from app.models.company_membership import CompanyMembership
from app.models.permission_profile import MembershipPermissionProfileAssignment
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.models.permission_profile import MembershipPermissionProfileScope, PermissionProfile
from app.services.organization_base_profile_service import CONSULTATION_PROFILE_NAME
from credentials import login_form
from tests.test_user_invitations import _register_company, _accept_payload


def _link(client, headers, email, role_id=3):
    result = client.post("/api/v1/user-invitations/", headers=headers, json={
        "email": email, "role_id": role_id, "delivery": "link",
    })
    assert result.status_code == 202, result.text
    data = result.json()
    assert data["delivery"] == "link"
    url = urlparse(data["invitation_url"])
    assert not url.query
    token = parse_qs(url.fragment)["token"][0]
    return data, _accept_payload(token, data["verification_code"])


def _identity(user):
    return (user.company_id, user.role_id, user.hashed_password, user.session_version, user.is_active)


def test_manual_link_works_without_smtp_and_secrets_are_creation_only(client, db, monkeypatch):
    headers, company_id = _register_company(client, "manual-link")
    monkeypatch.setattr(settings, "SMTP_HOST", "")
    monkeypatch.setattr("app.services.email_service.send_worker_invitation_email", lambda **_: (_ for _ in ()).throw(AssertionError("link must not send email")))
    data, payload = _link(client, headers, "manual-worker@example.com")
    invitation = db.query(UserInvitation).one()
    assert invitation.token_hash != payload["token"]
    assert invitation.code_hash != payload["code"]
    for path in ["/api/v1/user-invitations/", f"/api/v1/audit-logs/?company_id={company_id}"]:
        result = client.get(path, headers=headers)
        assert result.status_code == 200, result.text
        assert payload["token"] not in result.text
        assert payload["code"] not in result.text
    no_password = {key: value for key, value in payload.items() if key != "password"}
    assert client.post("/api/v1/user-invitations/accept", json=no_password).status_code == 422
    assert db.query(User).filter(User.email == data["email"]).count() == 0
    accepted = client.post("/api/v1/user-invitations/accept", json=payload)
    assert accepted.status_code == 200, accepted.text
    assert client.post("/api/v1/user-invitations/accept", json=payload).status_code == 400


def test_existing_admin_accepts_worker_company_only_with_own_identity_and_revocation_is_local(client, db):
    headers_a, company_a = _register_company(client, "identity-a")
    headers_b, company_b = _register_company(client, "identity-b")
    user = db.query(User).filter(User.company_id == company_a).one()
    before = _identity(user)
    membership_a = db.query(CompanyMembership).filter_by(company_id=company_a, user_id=user.id).one()
    a_profile_ids = {row.id for row in db.query(MembershipPermissionProfileAssignment).filter_by(company_membership_id=membership_a.id, is_active=True)}
    _, payload = _link(client, headers_b, user.email)
    payload.pop("password")
    client.cookies.clear()
    assert client.post("/api/v1/user-invitations/accept", json=payload).status_code == 401
    assert client.post("/api/v1/user-invitations/accept", headers={"Authorization": "Bearer invalid"}, json=payload).status_code == 401
    assert client.post("/api/v1/user-invitations/accept", headers=headers_b, json=payload).status_code == 403
    assert db.query(CompanyMembership).filter_by(company_id=company_b, user_id=user.id).count() == 0
    accepted = client.post("/api/v1/user-invitations/accept", headers=headers_a, json=payload)
    assert accepted.status_code == 200, accepted.text
    membership_b = db.query(CompanyMembership).filter_by(company_id=company_b, user_id=user.id).one()
    assert membership_b.access_class == "worker"
    assert membership_b.permissions_configured is False
    assert db.query(MembershipPermissionProfileAssignment).filter_by(company_membership_id=membership_b.id).count() == 0
    db.refresh(user)
    assert _identity(user) == before
    switched = client.post("/api/v1/session/company", headers=headers_a, json={"company_id": company_b})
    assert switched.status_code == 200, switched.text
    headers_worker_b = {"Authorization": f"Bearer {switched.json()['access_token']}"}
    assert client.get("/api/v1/organization/members", headers=headers_worker_b).status_code == 403
    assert client.get("/api/v1/expenses/", headers=headers_worker_b).status_code == 403
    removed = client.delete(f"/api/v1/organization/members/{membership_b.id}", headers=headers_b)
    assert removed.status_code == 204, removed.text
    assert client.get("/api/v1/users/me", headers=headers_worker_b).status_code == 403
    assert client.get("/api/v1/organization/members", headers=headers_a).status_code == 200
    db.refresh(user)
    assert _identity(user) == before
    assert db.query(MembershipPermissionProfileAssignment).filter_by(company_membership_id=membership_a.id, is_active=True).count() == len(a_profile_ids)
    assert membership_b.permissions_configured is True


def test_local_class_and_suspension_never_change_another_company_or_global_account(client, db):
    headers_a, company_a = _register_company(client, "class-a")
    headers_b, company_b = _register_company(client, "class-b")
    user = db.query(User).filter(User.company_id == company_a).one()
    before = _identity(user)
    _, payload = _link(client, headers_b, user.email)
    accepted = client.post("/api/v1/user-invitations/accept", headers=headers_a, json=payload)
    assert accepted.status_code == 200, accepted.text
    member = db.query(CompanyMembership).filter_by(company_id=company_b, user_id=user.id).one()
    promoted = client.patch(f"/api/v1/organization/members/{member.id}", headers=headers_b, json={"access_class": "admin"})
    assert promoted.status_code == 200, promoted.text
    assert promoted.json()["profile_assignments"]
    changed = client.patch(f"/api/v1/organization/members/{member.id}", headers=headers_b, json={"access_class": "worker", "status": "suspended"})
    assert changed.status_code == 200, changed.text
    assert changed.json()["profile_assignments"] == []
    assert changed.json()["legacy_role_name"] == "viewer"
    db.refresh(user)
    assert _identity(user) == before
    assert client.get("/api/v1/organization/members", headers=headers_a).status_code == 200
    assert db.query(CompanyMembership).filter_by(company_id=company_a, user_id=user.id).one().access_class == "admin"
    events = client.get(f"/api/v1/audit-logs/?company_id={company_b}", headers=headers_b)
    assert events.status_code == 200, events.text
    serialized = json.dumps(events.json())
    assert payload["token"] not in serialized and payload["code"] not in serialized


def test_pending_invitations_are_independent_between_companies(client, db):
    headers_a, company_a = _register_company(client, "pending-independent-a")
    headers_b, company_b = _register_company(client, "pending-independent-b")
    _link(client, headers_a, "shared-invite@example.com")
    _link(client, headers_b, "shared-invite@example.com")
    rows = db.query(UserInvitation).filter_by(email="shared-invite@example.com").all()
    assert {row.company_id for row in rows} == {company_a, company_b}
    assert len({row.token_hash for row in rows}) == 2


def test_initial_worker_cannot_read_general_planning_or_reports_but_explicit_profile_is_respected(client, db):
    headers_a, company_a = _register_company(client, "operational-initial-a")
    headers_b, company_b = _register_company(client, "operational-initial-b")
    user = db.query(User).filter_by(company_id=company_a).one()
    _, payload = _link(client, headers_b, user.email)
    assert client.post("/api/v1/user-invitations/accept", headers=headers_a, json=payload).status_code == 200
    switch = client.post("/api/v1/session/company", headers=headers_a, json={"company_id": company_b})
    headers = {"Authorization": f"Bearer {switch.json()['access_token']}"}
    report = {"name":"Mis trabajos", "kind":"work", "columns":["id","title"], "starts_on":"2026-01-01", "ends_on":"2026-12-31"}
    assert client.get("/api/v1/work-orders/", headers=headers).status_code == 403
    assert client.get("/api/v1/work-orders/999999", headers=headers).status_code == 403
    assert client.post("/api/v1/custom-reports/run", headers=headers, json=report).status_code == 403
    assert client.post("/api/v1/custom-reports", headers=headers, json=report).status_code == 403
    member = db.query(CompanyMembership).filter_by(company_id=company_b,user_id=user.id).one()
    profile = db.query(PermissionProfile).filter_by(company_id=company_b,name=CONSULTATION_PROFILE_NAME).one()
    assignment = MembershipPermissionProfileAssignment(company_id=company_b, company_membership_id=member.id, permission_profile_id=profile.id, is_active=True)
    db.add(assignment); db.flush()
    db.add(MembershipPermissionProfileScope(company_id=company_b, profile_assignment_id=assignment.id, scope_type="company", scope_id=company_b))
    member.permissions_configured = True
    db.commit()
    allowed = client.get("/api/v1/work-orders/", headers=headers)
    assert allowed.status_code == 200, allowed.text
    allowed = client.post("/api/v1/custom-reports/run", headers=headers, json=report)
    assert allowed.status_code == 200, allowed.text


def test_archived_identity_can_sign_in_to_accept_another_company_without_reopening_previous_access(client, db):
    headers_a, company_a = _register_company(client, "archived-consent-a")
    headers_owner, company_b = _register_company(client, "archived-consent-b")
    user = db.query(User).filter_by(company_id=company_a).one()
    membership_a = db.query(CompanyMembership).filter_by(company_id=company_a,user_id=user.id).one()
    membership_a.status = "archived"
    membership_a.permissions_configured = True
    db.commit()
    client.cookies.clear()
    login = client.post("/api/v1/auth/login", data=login_form(user.email))
    assert login.status_code == 200, login.text
    identity_headers = {"Authorization":f"Bearer {login.json()['access_token']}"}
    assert client.get("/api/v1/users/me", headers=identity_headers).status_code == 403
    _, payload = _link(client, headers_owner, user.email)
    payload.pop("password")
    accepted = client.post("/api/v1/user-invitations/accept", headers=identity_headers, json=payload)
    assert accepted.status_code == 200, accepted.text
    assert client.get("/api/v1/users/me", headers=headers_a).status_code == 403
    login = client.post("/api/v1/auth/login", data=login_form(user.email))
    assert login.status_code == 200, login.text
    new_headers = {"Authorization":f"Bearer {login.json()['access_token']}"}
    context = client.get("/api/v1/users/me", headers=new_headers)
    assert context.status_code == 200, context.text
    assert context.json()["company_id"] == company_b
    assert context.json()["role"]["name"] == "viewer"
