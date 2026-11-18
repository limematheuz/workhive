"""Manual delivery retains the portal lifecycle without sending any email."""

from datetime import timedelta

from credentials import TEST_SECRET_B, login_form
from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.client_portal_invitation import ClientPortalInvitation
from app.models.user import User
from app.services.client_portal_invitation_service import utcnow
from app.services.company_collaboration_invitation_tokens import hash_invitation_secret
from test_client_portal_api import _client, _company, _internal_user


def _setup(db, monkeypatch, suffix):
    monkeypatch.setattr(settings, "SMTP_HOST", None)
    def no_mail(**kwargs):
        raise AssertionError("Manual delivery must never invoke the email sender")
    monkeypatch.setattr("app.services.email_service.send_client_portal_invitation_email", no_mail)
    company = _company(db, suffix)
    admin, headers = _internal_user(db, company=company, suffix=suffix)
    customer = _client(db, company=company, suffix=suffix)
    db.commit()
    return admin, headers, customer


def _accept_payload(created):
    return {
        "token": created["invitation_url"].split("#token=", 1)[1],
        "verification_code": created["verification_code"],
        "full_name": "Portal link test",
        "password": TEST_SECRET_B,
        "accept_terms": True,
        "accept_privacy": True,
    }


def test_link_works_without_smtp_and_secrets_are_one_time_only(client, db, monkeypatch):
    _, headers, customer = _setup(db, monkeypatch, "LINK")
    path = f"/api/v1/client-portal/clients/{customer.id}/invitations"
    result = client.post(path, headers=headers, json={"email": "manual-client@example.com", "delivery": "link"})
    assert result.status_code == 201, result.text
    created = result.json()
    assert created["delivery"] == "link"
    assert "?token=" not in created["invitation_url"]
    payload = _accept_payload(created)
    invitation = db.get(ClientPortalInvitation, created["id"])
    assert invitation.token_hash == hash_invitation_secret(payload["token"])
    assert invitation.verification_code_hash == hash_invitation_secret(payload["verification_code"])
    listed = client.get(path, headers=headers)
    assert listed.status_code == 200
    assert "invitation_url" not in listed.json()[0]
    assert "verification_code" not in listed.json()[0]
    audits = str([(row.action, row.details) for row in db.query(AuditLog).all()])
    assert payload["token"] not in audits
    assert payload["verification_code"] not in audits
    accepted = client.post("/api/v1/client-portal/invitations/accept", json=payload)
    assert accepted.status_code == 200, accepted.text
    user = db.query(User).filter(User.email == created["email"]).one()
    assert user.company_id is None and user.role.name == "client_portal"
    assert client.post("/api/v1/client-portal/invitations/accept", json=payload).status_code == 400
    login = client.post("/api/v1/auth/login", data=login_form(created["email"], TEST_SECRET_B))
    assert login.status_code == 200
    portal_headers = {"Authorization": "Bearer " + login.json()["access_token"]}
    workspaces = client.get("/api/v1/client-portal/workspaces", headers=portal_headers)
    assert workspaces.status_code == 200 and len(workspaces.json()) == 1
    assert client.get("/api/v1/users", headers=portal_headers).status_code == 403


def test_link_keeps_company_and_identity_boundaries(client, db, monkeypatch):
    admin, headers, customer = _setup(db, monkeypatch, "LINK-SCOPE")
    foreign_company = _company(db, "LINK-FOREIGN")
    _, foreign_headers = _internal_user(db, company=foreign_company, suffix="LINK-FOREIGN")
    db.commit()
    path = f"/api/v1/client-portal/clients/{customer.id}/invitations"
    assert client.post(path, headers=foreign_headers, json={"email": "outsider@example.com", "delivery": "link"}).status_code == 404
    assert client.post(path, json={"email": "outsider@example.com", "delivery": "link"}).status_code == 401
    assert client.post(path, headers=headers, json={"email": admin.email, "delivery": "link"}).status_code == 400
    assert client.post(path, headers=headers, json={"email": "email-default@example.com"}).status_code == 503
    assert db.query(ClientPortalInvitation).count() == 0


def test_link_code_expiry_and_revocation_are_enforced(client, db, monkeypatch):
    _, headers, customer = _setup(db, monkeypatch, "LINK-EXPIRY")
    path = f"/api/v1/client-portal/clients/{customer.id}/invitations"
    created = client.post(path, headers=headers, json={"email": "expired-client@example.com", "delivery": "link"}).json()
    payload = _accept_payload(created)
    assert client.post("/api/v1/client-portal/invitations/accept", json={**payload, "verification_code": "INVALIDCODE"}).status_code == 400
    invitation = db.get(ClientPortalInvitation, created["id"])
    invitation.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    assert client.post("/api/v1/client-portal/invitations/accept", json=payload).status_code == 410
    replacement = client.post(path, headers=headers, json={"email": created["email"], "delivery": "link"})
    assert replacement.status_code == 201
    revoked = client.delete(path + "/" + str(replacement.json()["id"]), headers=headers)
    assert revoked.status_code == 200
    assert "invitation_url" not in revoked.json() and "verification_code" not in revoked.json()
    assert client.post("/api/v1/client-portal/invitations/accept", json=_accept_payload(replacement.json())).status_code == 400
