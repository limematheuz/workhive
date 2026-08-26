import json
import logging
import smtplib
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from app.core.security import get_password_hash
from app.models.company import Company
from app.models.privacy_consent import PrivacyConsent
from app.models.user import User
from app.models.user_invitation import UserInvitation
from credentials import TEST_SECRET, login_form


def _register_company(client, suffix: str) -> tuple[dict[str, str], int]:
    email = f"invite-admin-{suffix}@workhive.com"
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": TEST_SECRET,
            "full_name": f"Invite Admin {suffix}",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    assert registration.status_code == 201, registration.text
    login = client.post("/api/v1/auth/login", data=login_form(email))
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": f"Invite Company {suffix}",
            "tax_id": f"INVITE-{suffix}",
            "address": "Invite Street 1",
            "phone": "600000000",
            "email": email,
        },
    )
    assert company.status_code == 201, company.text
    return headers, company.json()["id"]


def _capture_invitation(monkeypatch) -> dict[str, object]:
    sent: dict[str, object] = {}

    def send(**kwargs) -> bool:
        sent.update(kwargs)
        return True

    monkeypatch.setattr(
        "app.services.email_service.send_worker_invitation_email",
        send,
    )
    return sent


def _invitation_token(sent: dict[str, object]) -> str:
    return parse_qs(urlparse(str(sent["invitation_url"])).fragment)["token"][0]


def _accept_payload(token: str, code: str) -> dict[str, object]:
    return {
        "token": token,
        "code": code,
        "password": TEST_SECRET,
        "accept_terms": True,
        "accept_privacy": True,
    }


def _different_code(code: str) -> str:
    return f"{(int(code) + 1) % 100_000_000:08d}"


def test_worker_is_created_only_after_email_code_verification(client, db, monkeypatch):
    headers, company_id = _register_company(client, "verification")
    sent = _capture_invitation(monkeypatch)

    invitation_response = client.post(
        "/api/v1/user-invitations/",
        headers=headers,
        json={
            "email": "new-worker@workhive.com",
            "full_name": "New Worker",
            "role_id": 3,
        },
    )
    assert invitation_response.status_code == 202, invitation_response.text
    assert db.query(User).filter(User.email == "new-worker@workhive.com").first() is None
    invitation = db.query(UserInvitation).one()
    assert invitation.company_id == company_id
    assert invitation.code_hash != sent["verification_code"]

    token = _invitation_token(sent)
    invalid_code = client.post(
        "/api/v1/user-invitations/accept",
        json=_accept_payload(token, _different_code(str(sent["verification_code"]))),
    )
    assert invalid_code.status_code == 400
    assert db.query(User).filter(User.email == "new-worker@workhive.com").first() is None

    accepted = client.post(
        "/api/v1/user-invitations/accept",
        json=_accept_payload(token, str(sent["verification_code"])),
    )
    assert accepted.status_code == 200, accepted.text
    worker = db.query(User).filter(User.email == "new-worker@workhive.com").one()
    assert worker.company_id == company_id
    assert worker.email_verified_at is not None
    assert worker.role.name == "viewer"
    assert db.query(PrivacyConsent).filter(PrivacyConsent.user_id == worker.id).count() == 3

    login = client.post("/api/v1/auth/login", data=login_form(worker.email))
    assert login.status_code == 200
    replay = client.post(
        "/api/v1/user-invitations/accept",
        json=_accept_payload(token, str(sent["verification_code"])),
    )
    assert replay.status_code == 400


def test_worker_invitation_requires_manager_or_admin(client):
    response = client.post(
        "/api/v1/user-invitations/",
        json={"email": "unauthorized@workhive.com", "role_id": 3},
    )
    assert response.status_code == 401


def test_direct_worker_creation_endpoint_is_not_available(client):
    response = client.post(
        "/api/v1/users/", json={})
    assert response.status_code == 405


def test_expired_invitation_cannot_create_a_worker(client, db, monkeypatch):
    headers, _ = _register_company(client, "expired")
    sent = _capture_invitation(monkeypatch)
    response = client.post(
        "/api/v1/user-invitations/",
        headers=headers,
        json={"email": "expired-worker@workhive.com", "role_id": 3},
    )
    assert response.status_code == 202
    invitation = db.query(UserInvitation).one()
    invitation.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()

    accepted = client.post(
        "/api/v1/user-invitations/accept",
        json=_accept_payload(_invitation_token(sent), str(sent["verification_code"])),
    )
    assert accepted.status_code == 410
    assert invitation.status == "expired"
    assert db.query(User).filter(User.email == "expired-worker@workhive.com").first() is None


def test_five_invalid_codes_expire_the_invitation(client, db, monkeypatch):
    headers, _ = _register_company(client, "attempts")
    sent = _capture_invitation(monkeypatch)
    client.post(
        "/api/v1/user-invitations/",
        headers=headers,
        json={"email": "attempt-worker@workhive.com", "role_id": 3},
    )
    token = _invitation_token(sent)
    wrong_code = _different_code(str(sent["verification_code"]))
    for _ in range(5):
        response = client.post(
            "/api/v1/user-invitations/accept",
            json=_accept_payload(token, wrong_code),
        )
        assert response.status_code == 400
    invitation = db.query(UserInvitation).one()
    assert invitation.status == "expired"
    assert invitation.failed_attempts == 5


def test_resending_replaces_the_previous_secret_and_keeps_one_pending_invitation(
    client, db, monkeypatch
):
    headers, _ = _register_company(client, "resend")
    deliveries: list[dict[str, object]] = []
    monkeypatch.setattr(
        "app.services.email_service.send_worker_invitation_email",
        lambda **kwargs: deliveries.append(kwargs) or True,
    )
    payload = {"email": "resend-worker@workhive.com", "full_name": "Resend", "role_id": 3}
    assert client.post("/api/v1/user-invitations/", headers=headers, json=payload).status_code == 202
    assert client.post("/api/v1/user-invitations/", headers=headers, json=payload).status_code == 202
    assert len(deliveries) == 2
    assert db.query(UserInvitation).count() == 1

    old = deliveries[0]
    old_accept = client.post(
        "/api/v1/user-invitations/accept",
        json=_accept_payload(_invitation_token(old), str(old["verification_code"])),
    )
    assert old_accept.status_code == 400
    latest = deliveries[1]
    new_accept = client.post(
        "/api/v1/user-invitations/accept",
        json=_accept_payload(_invitation_token(latest), str(latest["verification_code"])),
    )
    assert new_accept.status_code == 200


def test_delivery_failure_does_not_leave_an_usable_invitation(client, db, monkeypatch):
    headers, _ = _register_company(client, "delivery-failure")
    monkeypatch.setattr(
        "app.services.email_service.send_worker_invitation_email",
        lambda **_kwargs: False,
    )
    response = client.post(
        "/api/v1/user-invitations/",
        headers=headers,
        json={"email": "undelivered@workhive.com", "role_id": 3},
    )
    assert response.status_code == 503
    assert db.query(UserInvitation).count() == 0


def test_delivery_exception_logs_no_recipient_or_secret(client, db, monkeypatch, caplog):
    headers, _ = _register_company(client, "delivery-exception")

    def fail_delivery(**_kwargs):
        raise smtplib.SMTPException("provider rejected recipient")

    monkeypatch.setattr(
        "app.services.email_service.send_worker_invitation_email",
        fail_delivery,
    )
    with caplog.at_level(logging.WARNING):
        response = client.post(
            "/api/v1/user-invitations/",
            headers=headers,
            json={"email": "not-logged@workhive.com", "role_id": 3},
        )
    assert response.status_code == 503
    assert "SMTPException" in caplog.text
    assert "not-logged@workhive.com" not in caplog.text
    assert db.query(UserInvitation).count() == 0


def test_invitation_rejects_existing_email_regardless_of_case(client, db, monkeypatch):
    headers, _ = _register_company(client, "email-case")
    db.add(
        User(
            email="Existing.Worker@WorkHive.com",
            hashed_password=get_password_hash(TEST_SECRET),
            role_id=3,
            is_active=True,
        )
    )
    db.commit()
    _capture_invitation(monkeypatch)
    response = client.post(
        "/api/v1/user-invitations/",
        headers=headers,
        json={"email": "existing.worker@workhive.com", "role_id": 3},
    )
    assert response.status_code == 409


def test_acceptance_rechecks_company_capacity(client, db, monkeypatch):
    headers, company_id = _register_company(client, "capacity")
    company = db.get(Company, company_id)
    company.subscription_plan = "free"
    company.subscription_status = "active"
    db.commit()
    sent = _capture_invitation(monkeypatch)
    assert client.post(
        "/api/v1/user-invitations/",
        headers=headers,
        json={"email": "capacity-worker@workhive.com", "role_id": 3},
    ).status_code == 202
    db.add_all([
        User(email="capacity-one@workhive.com", hashed_password=get_password_hash(TEST_SECRET), role_id=3, company_id=company_id, is_active=True),
        User(email="capacity-two@workhive.com", hashed_password=get_password_hash(TEST_SECRET), role_id=3, company_id=company_id, is_active=True),
    ])
    db.commit()
    response = client.post(
        "/api/v1/user-invitations/accept",
        json=_accept_payload(_invitation_token(sent), str(sent["verification_code"])),
    )
    assert response.status_code == 409
    assert db.query(User).filter(User.email == "capacity-worker@workhive.com").first() is None


def test_invitation_requires_legal_consent_and_audit_never_contains_secrets(client, db, monkeypatch):
    headers, company_id = _register_company(client, "consent")
    sent = _capture_invitation(monkeypatch)
    assert client.post(
        "/api/v1/user-invitations/",
        headers=headers,
        json={"email": "consent-worker@workhive.com", "role_id": 3},
    ).status_code == 202
    token = _invitation_token(sent)
    denied = client.post(
        "/api/v1/user-invitations/accept",
        json={"token": token, "code": sent["verification_code"], "password": TEST_SECRET},
    )
    assert denied.status_code == 422
    events = client.get(f"/api/v1/audit-logs/?company_id={company_id}", headers=headers)
    assert events.status_code == 200
    serialized_events = json.dumps(events.json())
    assert token not in serialized_events
    assert str(sent["verification_code"]) not in serialized_events
    assert TEST_SECRET not in serialized_events
