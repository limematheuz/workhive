from urllib.parse import parse_qs, urlsplit

from app.core.security import get_password_hash
from app.models.user import User

TEAM = "/api/v1/platform-team"
PASSWORD = "TestOnly@Secure2026"


def login(client, email):
    return client.post("/api/v1/auth/login", data={"username": email, "password": PASSWORD})


def account(db, role, company_id=None):
    user = User(email="operator@example.com", full_name="Operator", role_id=role, company_id=company_id,
                hashed_password=get_password_hash(PASSWORD))
    db.add(user)
    db.commit()
    return user.email


def test_invitation_preserves_session_and_revocation_invalidates_access(client, db, monkeypatch):
    monkeypatch.setattr("app.services.platform_team.notify_invitee", lambda email, url: False)
    founder = account(db, 4)
    session = login(client, founder)
    assert session.status_code == 200
    headers = {"X-CSRF-Token": session.json()["csrf_token"]}
    email = "tech@example.com"
    assert client.post(TEAM, json={"email": email}).status_code == 403
    invitation = client.post(TEAM, json={"email": email}, headers=headers)
    assert invitation.status_code == 201, invitation.text
    assert client.get(TEAM).status_code == 200
    assert client.post(TEAM, json={"email": email}, headers=headers).status_code == 409
    roster = client.get(TEAM).json()
    invite_id = next(row["id"] for row in roster if row["email"] == email)
    token = parse_qs(urlsplit(invitation.json()["invitation_url"]).fragment)["token"][0]
    client.cookies.clear()
    reset = {"token": token, "new_password": PASSWORD}
    assert client.post("/api/v1/auth/reset-password", json=reset).status_code == 200
    assert client.post("/api/v1/auth/reset-password", json=reset).status_code == 400
    tech = login(client, email)
    assert tech.status_code == 200
    assert client.get(TEAM).status_code == 200
    founder_session = login(client, founder).json()
    assert client.delete(f"{TEAM}/{invite_id}", headers={"X-CSRF-Token": founder_session["csrf_token"]}).status_code == 204
    assert client.get(TEAM, headers={"Authorization": "Bearer " + tech.json()["access_token"]}).status_code == 401
    assert client.get(TEAM).status_code == 200


def test_team_rejects_public_and_company_access(client, db):
    assert client.get(TEAM).status_code == 401
    from test_organization_api import _company
    company = _company(db, "team-access")
    session = login(client, account(db, 1, company.id))
    assert session.status_code == 200
    assert client.get(TEAM).status_code == 403
    assert client.post(TEAM, json={"email": "tech@example.com"},
                       headers={"X-CSRF-Token": session.json()["csrf_token"]}).status_code == 403
    assert client.post(f"{TEAM}/1/resend", headers={"X-CSRF-Token": session.json()["csrf_token"]}).status_code == 403
    assert client.get("/api/v1/platform-access/start").status_code == 404


def test_expired_or_revoked_invites_cannot_activate(client, db, monkeypatch):
    from app.models.platform_invitation import PlatformInvitation

    monkeypatch.setattr("app.services.platform_team.notify_invitee", lambda email, url: False)
    session = login(client, account(db, 4)).json()
    headers = {"X-CSRF-Token": session["csrf_token"]}
    for condition in ("expired", "revoked"):
        email = condition + "@example.com"
        invitation = client.post(TEAM, json={"email": email}, headers=headers).json()
        token = parse_qs(urlsplit(invitation["invitation_url"]).fragment)["token"][0]
        row = db.query(PlatformInvitation).filter_by(email=email).one()
        if condition == "expired":
            row.expires_at = 0
            db.commit()
        else:
            assert client.delete(f"{TEAM}/{row.id}", headers=headers).status_code == 204
        assert client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": PASSWORD}).status_code == 400
        assert db.query(User).filter_by(email=email).first() is None


def test_production_invitation_requires_email_delivery(client, db, monkeypatch):
    from app.core.config import settings
    from app.models.platform_invitation import PlatformInvitation

    headers = {"X-CSRF-Token": login(client, account(db, 4)).json()["csrf_token"]}
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr("app.services.platform_team.notify_invitee", lambda email, url: False)
    payload = {"email": "delivery@example.com"}
    failed = client.post(TEAM, json=payload, headers=headers)
    assert failed.status_code == 503
    assert db.query(PlatformInvitation).one().token_digest is None
    monkeypatch.setattr("app.services.platform_team.notify_invitee", lambda email, url: True)
    retry = client.post(TEAM, json=payload, headers=headers)
    assert retry.status_code == 201
    assert retry.json() == {"email_sent": True, "invitation_url": None}


def test_founder_recovery_is_bound_to_current_account_and_session_version(client, db):
    from app.core.security import create_password_reset_token

    email = account(db, 4)
    person = db.query(User).filter_by(email=email).one()
    unbound = create_password_reset_token(email)
    first = create_password_reset_token(email, user_id=person.id, version=person.session_version)
    second = create_password_reset_token(email, user_id=person.id, version=person.session_version)
    for token, status in ((unbound, 400), (first, 200), (second, 400)):
        result = client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": PASSWORD})
        assert result.status_code == status


def test_resend_rotates_token_preserves_session_and_blocks_active_or_revoked(client, db, monkeypatch):
    deliveries = []
    def send(email, url):
        deliveries.append(parse_qs(urlsplit(url).fragment)["token"][0])
        return True

    monkeypatch.setattr("app.services.platform_team.notify_invitee", send)
    headers = {"X-CSRF-Token": login(client, account(db, 4)).json()["csrf_token"]}
    email = "resend@example.com"
    assert client.post(TEAM, json={"email": email}, headers=headers).status_code == 201
    identifier = next(row["id"] for row in client.get(TEAM).json() if row["email"] == email)
    path = f"{TEAM}/{identifier}/resend"
    assert client.post(path).status_code == 403
    result = client.post(path, headers=headers)
    assert result.status_code == 200
    assert result.json() == {"email_sent": True, "invitation_url": None}
    assert client.get(TEAM).status_code == 200
    assert len(deliveries) == 2 and deliveries[0] != deliveries[1]
    for token, status in zip(deliveries, (400, 200)):
        assert client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": PASSWORD}).status_code == status
    assert client.post(path, headers=headers).status_code == 409
    assert client.delete(f"{TEAM}/{identifier}", headers=headers).status_code == 204
    assert client.post(path, headers=headers).status_code == 409


def test_failed_production_resend_retains_digest_and_expired_invite_can_be_renewed(client, db, monkeypatch):
    from time import time
    from app.core.config import settings
    from app.models.platform_invitation import PlatformInvitation

    headers = {"X-CSRF-Token": login(client, account(db, 4)).json()["csrf_token"]}
    monkeypatch.setattr("app.services.platform_team.notify_invitee", lambda email, url: True)
    assert client.post(TEAM, json={"email": "renew@example.com"}, headers=headers).status_code == 201
    row = db.query(PlatformInvitation).one()
    previous = row.token_digest
    path = f"{TEAM}/{row.id}/resend"
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr("app.services.platform_team.notify_invitee", lambda email, url: False)
    assert client.post(path, headers=headers).status_code == 503
    db.refresh(row)
    assert row.token_digest == previous and row.expires_at > time()
    row.expires_at = 0
    db.commit()
    monkeypatch.setattr("app.services.platform_team.notify_invitee", lambda email, url: True)
    assert client.post(path, headers=headers).status_code == 200
    db.refresh(row)
    assert row.token_digest != previous and row.expires_at > time()


def test_revoked_technician_returns_only_after_fresh_acceptance(client, db, monkeypatch):
    links = []
    def capture(email, url):
        links.append(parse_qs(urlsplit(url).fragment)["token"][0])
        return True

    monkeypatch.setattr("app.services.platform_team.notify_invitee", capture)
    founder = login(client, account(db, 4)).json()
    manager = {"Authorization": "Bearer " + founder["access_token"]}
    email = "returning@example.com"
    payload = {"email": email}
    reset = "/api/v1/auth/reset-password"
    def accept(token, password=PASSWORD):
        return client.post(reset, json={"token": token, "new_password": password}).status_code
    def entry():
        return next(row for row in client.get(TEAM, headers=manager).json() if row["email"] == email)

    assert client.post(TEAM, headers=manager, json=payload).status_code == 201
    assert accept(links[-1]) == 200
    member_id = db.query(User).filter_by(email=email).one().id
    old_session = {"Authorization": "Bearer " + login(client, email).json()["access_token"]}
    path = f"{TEAM}/{entry()['id']}"
    assert client.delete(path, headers=manager).status_code == 204
    assert client.post(TEAM, headers=manager, json=payload).status_code == 201
    assert client.patch(f"/api/v1/users/{member_id}", headers=manager, json={"is_active": True}).status_code == 409
    assert entry()["status"] == "pendiente"
    assert login(client, email).status_code != 200
    assert accept(links[0]) == 400
    assert client.post(path + "/resend", headers=manager).status_code == 200
    assert accept(links[-2]) == 400
    new_password = PASSWORD + "2"
    assert accept(links[-1], new_password) == 200
    assert accept(links[-1], new_password) == 400
    assert db.query(User).filter_by(email=email).one().id == member_id
    assert client.get(TEAM, headers=old_session).status_code == 401
    assert login(client, email).status_code == 401
    assert client.post("/api/v1/auth/login", data={"username": email, "password": new_password}).status_code == 200
    assert entry()["status"] == "activa"


def test_invite_preserves_unrelated_identity_and_failed_reinvitation(client, db, monkeypatch):
    from app.core.config import settings
    from app.models.platform_invitation import PlatformInvitation

    headers = {"X-CSRF-Token": login(client, account(db, 4)).json()["csrf_token"]}
    other = User(email="employee@example.com", role_id=1, is_active=False,
                 hashed_password=get_password_hash(PASSWORD))
    db.add(other)
    db.commit()
    assert client.post(TEAM, headers=headers, json={"email": other.email}).status_code == 409
    assert other.role_id == 1 and not other.is_active
    email = "technical@example.com"
    monkeypatch.setattr("app.services.platform_team.notify_invitee", lambda email, url: False)
    invitation = client.post(TEAM, headers=headers, json={"email": email}).json()
    token = parse_qs(urlsplit(invitation["invitation_url"]).fragment)["token"][0]
    assert client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": PASSWORD}).status_code == 200
    row = db.query(PlatformInvitation).one()
    assert client.delete(f"{TEAM}/{row.id}", headers=headers).status_code == 204
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert client.post(TEAM, headers=headers, json={"email": email}).status_code == 503
    db.refresh(row)
    assert row.revoked_by and row.token_digest is None
    assert not db.get(User, row.member_id).is_active
