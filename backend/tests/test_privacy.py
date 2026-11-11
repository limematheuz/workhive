import smtplib
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.audit_log import AuditLog
from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.data_subject_request import DataSubjectRequest
from app.models.user import User
from app.services import privacy_service
from credentials import CREDENTIAL_FIELD, TEST_SECRET, login_form


@pytest.fixture(autouse=True)
def mock_privacy_email_delivery(monkeypatch):
    monkeypatch.setattr(
        "app.services.email_service.send_erasure_request_received_email",
        lambda **_kwargs: True,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_erasure_request_resolved_email",
        lambda **_kwargs: True,
    )


def _register(client, email: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "Privacy User",
            "accept_terms": True,
            "accept_privacy": True,
            "marketing_consent": False,
            "policy_version": "2026-06-15",
        },
    )
    assert response.status_code == 201, response.text
    login = client.post(
        "/api/v1/auth/login",
        data=login_form(email, TEST_SECRET),
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _create_company(client, headers: dict[str, str], suffix: str = "") -> int:
    response = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": f"Privacy Company {suffix}",
            "tax_id": f"PRIVACY-001{suffix}",
            "address": "Privacy Street 1",
            "phone": "600000001",
            "email": f"privacy-company{suffix}@workhive.com",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_registration_requires_explicit_legal_acknowledgements(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "missing-consent@workhive.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "Missing Consent",
            "policy_version": "2026-06-15",
        },
    )
    assert response.status_code == 422


def test_consent_export_and_erasure_workflow(client, db):
    admin_headers = _register(client, "privacy-admin@workhive.com")
    company_id = _create_company(client, admin_headers)

    consents = client.get("/api/v1/privacy/consents", headers=admin_headers)
    assert consents.status_code == 200
    assert {
        (item["consent_type"], item["accepted"])
        for item in consents.json()
    } == {
        ("terms", True),
        ("privacy_notice", True),
        ("marketing", False),
    }

    worker = User(
        email="privacy-worker@workhive.com",
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="Privacy Worker",
        role_id=3,
        company_id=company_id,
        is_active=True,
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)
    worker_id = worker.id
    worker.photo_url = "/media/qa-privacy-photo.png"
    db.commit()
    original_password_hash = worker.hashed_password
    original_session_version = worker.session_version
    worker_login = client.post(
        "/api/v1/auth/login",
        data=login_form("privacy-worker@workhive.com", TEST_SECRET),
    )
    worker_token = worker_login.json()["access_token"]
    worker_headers = {"Authorization": f"Bearer {worker_token}"}

    exported = client.get("/api/v1/privacy/export", headers=worker_headers)
    assert exported.status_code == 200
    assert exported.json()["format"] == "workhive-data-export-v1"
    assert exported.json()["profile"]["email"] == "privacy-worker@workhive.com"
    assert "attachment" in exported.headers["content-disposition"]

    created = client.post(
        "/api/v1/privacy/requests",
        headers=worker_headers,
        json={
            "request_type": "erasure",
            "reason": "I no longer use the service",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["company_id"] == company_id

    resolved = client.post(
        f"/api/v1/privacy/requests/{created.json()['id']}/resolve",
        headers=admin_headers,
        json={
            "decision": "complete",
            "resolution_notes": "Identity verified and account anonymized",
        },
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["status"] == "completed"

    db.expire_all()
    anonymized = db.get(User, worker_id)
    assert anonymized.email == f"deleted+{worker_id}@invalid.workhive.local"
    assert anonymized.full_name == "Deleted user"
    assert anonymized.photo_url is None
    assert anonymized.hashed_password != original_password_hash
    assert anonymized.session_version > original_session_version
    assert anonymized.is_active is False
    assert db.get(Company, company_id).is_active is True

    blocked_login = client.post(
        "/api/v1/auth/login",
        data=login_form("privacy-worker@workhive.com", TEST_SECRET),
    )
    assert blocked_login.status_code == 401
    repeated = client.post(
        f"/api/v1/privacy/requests/{created.json()['id']}/resolve",
        headers=admin_headers,
        json={"decision": "complete", "resolution_notes": "Repeat QA resolution"},
    )
    assert repeated.status_code == 409
    assert client.get("/api/v1/users/me", headers=admin_headers).status_code == 200

    revoked = client.get("/api/v1/users/me", headers=worker_headers)
    assert revoked.status_code == 401

    users = client.get("/api/v1/users/", headers=admin_headers)
    assert users.status_code == 200
    assert all(item["id"] != worker_id for item in users.json())


@pytest.mark.parametrize("actor", ["anonymous", "requester", "coworker"])
def test_erasure_resolution_requires_admin_and_preserves_pending_request(client, db, actor):
    admin_headers = _register(client, "denied-erasure-admin@workhive.com")
    company_id = _create_company(client, admin_headers)
    worker = _add_worker(db, email="denied-erasure-worker@workhive.com", company_id=company_id)
    login = client.post("/api/v1/auth/login", data=login_form(worker.email, TEST_SECRET))
    worker_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    created = client.post(
        "/api/v1/privacy/requests", headers=worker_headers,
        json={"request_type": "erasure"},
    )
    assert created.status_code == 201, created.text
    headers = worker_headers if actor == "requester" else {}
    if actor == "anonymous":
        client.cookies.clear()
    if actor == "coworker":
        coworker = _add_worker(db, email="denied-erasure-peer@workhive.com", company_id=company_id)
        login = client.post("/api/v1/auth/login", data=login_form(coworker.email, TEST_SECRET))
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.post(
        f"/api/v1/privacy/requests/{created.json()['id']}/resolve", headers=headers,
        json={"decision": "complete", "resolution_notes": "Unauthorized QA attempt"},
    )
    assert response.status_code == (401 if actor == "anonymous" else 403)
    db.expire_all()
    assert db.get(User, worker.id).is_active is True
    pending = db.get(DataSubjectRequest, created.json()["id"])
    assert pending.status == "pending"
    assert pending.resolved_at is None
    assert pending.resolved_by_user_id is None
    assert pending.resolution_notes is None
    assert client.get("/api/v1/users/me", headers=worker_headers).status_code == 200
    assert db.query(AuditLog).filter(
        AuditLog.action == "privacy.request_resolved",
        AuditLog.entity_id == str(pending.id),
    ).count() == 0


def test_last_company_admin_erasure_deactivates_company(client, db):
    admin_headers = _register(client, "last-admin@workhive.com")
    company_id = _create_company(client, admin_headers)
    created = client.post(
        "/api/v1/privacy/requests",
        headers=admin_headers,
        json={"request_type": "erasure"},
    )
    assert created.status_code == 201

    resolved = client.post(
        f"/api/v1/privacy/requests/{created.json()['id']}/resolve",
        headers=admin_headers,
        json={
            "decision": "complete",
            "resolution_notes": "Attempted after identity verification",
        },
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["status"] == "completed"

    assert db.get(Company, company_id).is_active is False

    revoked = client.get("/api/v1/users/me", headers=admin_headers)
    assert revoked.status_code == 401

    blocked_login = client.post(
        "/api/v1/auth/login",
        data=login_form("last-admin@workhive.com", TEST_SECRET),
    )
    assert blocked_login.status_code == 401


def _add_worker(db, *, email: str, company_id: int) -> User:
    worker = User(
        email=email,
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="Privacy Worker",
        role_id=3,
        company_id=company_id,
        is_active=True,
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return worker


def test_erasure_request_sends_acknowledgement_without_blocking_the_request(
    client, db, monkeypatch
):
    admin_headers = _register(client, "ack-admin@workhive.com")
    company_id = _create_company(client, admin_headers)
    worker = _add_worker(db, email="ack-worker@workhive.com", company_id=company_id)
    delivered: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_erasure_request_received_email",
        lambda **kwargs: delivered.update(kwargs) or True,
    )
    worker_login = client.post("/api/v1/auth/login", data=login_form(worker.email, TEST_SECRET))
    worker_headers = {"Authorization": f"Bearer {worker_login.json()['access_token']}"}

    response = client.post(
        "/api/v1/privacy/requests",
        headers=worker_headers,
        json={"request_type": "erasure"},
    )
    assert response.status_code == 201, response.text
    assert delivered["recipient_email"] == worker.email
    assert delivered["recipient_name"] == worker.full_name
    assert delivered["response_due_at"].date().isoformat() > response.json()["requested_at"][:10]


def test_removed_person_keeps_a_privacy_request_linked_to_their_last_company(client, db):
    admin_headers = _register(client, "removed-person-admin@workhive.com")
    company_id = _create_company(client, admin_headers, "-removed-person")
    worker = _add_worker(
        db,
        email="removed-person@workhive.com",
        company_id=company_id,
    )
    membership = CompanyMembership(
        user_id=worker.id,
        company_id=company_id,
        access_class="worker",
        status="archived",
    )
    worker.company_id = None
    db.add(membership)
    db.commit()

    login = client.post("/api/v1/auth/login", data=login_form(worker.email, TEST_SECRET))
    assert login.status_code == 200, login.text
    request_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    created = client.post(
        "/api/v1/privacy/requests",
        headers=request_headers,
        json={"request_type": "erasure"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["company_id"] == company_id

    company_requests = client.get("/api/v1/privacy/requests", headers=admin_headers)
    assert company_requests.status_code == 200, company_requests.text
    assert created.json()["id"] in {item["id"] for item in company_requests.json()}


def test_erasure_resolution_emails_the_admin_message_before_anonymizing_user(
    client, db, monkeypatch
):
    admin_headers = _register(client, "resolve-admin@workhive.com")
    company_id = _create_company(client, admin_headers)
    worker = _add_worker(db, email="resolve-worker@workhive.com", company_id=company_id)
    monkeypatch.setattr(
        "app.services.email_service.send_erasure_request_received_email",
        lambda **_kwargs: True,
    )
    delivered: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_erasure_request_resolved_email",
        lambda **kwargs: delivered.update(kwargs) or True,
    )
    worker_login = client.post("/api/v1/auth/login", data=login_form(worker.email, TEST_SECRET))
    worker_headers = {"Authorization": f"Bearer {worker_login.json()['access_token']}"}
    created = client.post(
        "/api/v1/privacy/requests",
        headers=worker_headers,
        json={"request_type": "erasure"},
    )
    assert created.status_code == 201
    message = "Solicitud verificada; conservaremos solo los registros exigidos por ley."
    resolved = client.post(
        f"/api/v1/privacy/requests/{created.json()['id']}/resolve",
        headers=admin_headers,
        json={"decision": "complete", "resolution_notes": message},
    )
    assert resolved.status_code == 200, resolved.text
    assert delivered == {
        "recipient_email": "resolve-worker@workhive.com",
        "recipient_name": "Privacy Worker",
        "approved": True,
        "resolution_notes": message,
    }
    refreshed = db.get(User, worker.id)
    assert refreshed is not None and refreshed.is_active is False


def test_erasure_rejection_emails_message_and_keeps_account_active(client, db, monkeypatch):
    admin_headers = _register(client, "reject-admin@workhive.com")
    company_id = _create_company(client, admin_headers)
    worker = _add_worker(db, email="reject-worker@workhive.com", company_id=company_id)
    monkeypatch.setattr(
        "app.services.email_service.send_erasure_request_received_email",
        lambda **_kwargs: True,
    )
    delivered: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_erasure_request_resolved_email",
        lambda **kwargs: delivered.update(kwargs) or True,
    )
    worker_login = client.post("/api/v1/auth/login", data=login_form(worker.email, TEST_SECRET))
    worker_headers = {"Authorization": f"Bearer {worker_login.json()['access_token']}"}
    created = client.post(
        "/api/v1/privacy/requests",
        headers=worker_headers,
        json={"request_type": "erasure"},
    )
    message = "Necesitamos información adicional para verificar la solicitud."
    rejected = client.post(
        f"/api/v1/privacy/requests/{created.json()['id']}/resolve",
        headers=admin_headers,
        json={"decision": "reject", "resolution_notes": message},
    )
    assert rejected.status_code == 200
    assert delivered["approved"] is False
    assert delivered["resolution_notes"] == message
    assert db.get(User, worker.id).is_active is True


def test_erasure_email_failure_does_not_block_rights_request_or_leak_message_to_audit(
    client, db, monkeypatch
):
    admin_headers = _register(client, "delivery-admin@workhive.com")
    company_id = _create_company(client, admin_headers)
    worker = _add_worker(db, email="delivery-worker@workhive.com", company_id=company_id)
    monkeypatch.setattr(
        "app.services.email_service.send_erasure_request_received_email",
        lambda **_kwargs: False,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_erasure_request_resolved_email",
        lambda **_kwargs: False,
    )
    worker_login = client.post("/api/v1/auth/login", data=login_form(worker.email, TEST_SECRET))
    worker_headers = {"Authorization": f"Bearer {worker_login.json()['access_token']}"}
    created = client.post(
        "/api/v1/privacy/requests",
        headers=worker_headers,
        json={"request_type": "erasure"},
    )
    assert created.status_code == 201
    private_message = "Internal check reference: never expose this message"
    resolved = client.post(
        f"/api/v1/privacy/requests/{created.json()['id']}/resolve",
        headers=admin_headers,
        json={"decision": "complete", "resolution_notes": private_message},
    )
    assert resolved.status_code == 200
    audit_logs = client.get("/api/v1/audit-logs/", headers=admin_headers)
    assert audit_logs.status_code == 200
    assert private_message not in str(audit_logs.json())


def test_smtp_failure_does_not_block_an_erasure_request(client, db, monkeypatch):
    admin_headers = _register(client, "smtp-admin@workhive.com")
    company_id = _create_company(client, admin_headers)
    worker = _add_worker(db, email="smtp-worker@workhive.com", company_id=company_id)
    def unavailable_smtp(**_kwargs):
        raise smtplib.SMTPException("offline")

    monkeypatch.setattr(
        "app.services.email_service.send_erasure_request_received_email",
        unavailable_smtp,
    )
    worker_login = client.post("/api/v1/auth/login", data=login_form(worker.email, TEST_SECRET))
    worker_headers = {"Authorization": f"Bearer {worker_login.json()['access_token']}"}

    response = client.post(
        "/api/v1/privacy/requests",
        headers=worker_headers,
        json={"request_type": "erasure"},
    )

    assert response.status_code == 201, response.text


def test_privacy_email_is_only_sent_for_erasure_requests(client, db, monkeypatch):
    admin_headers = _register(client, "access-admin@workhive.com")
    company_id = _create_company(client, admin_headers)
    worker = _add_worker(db, email="access-worker@workhive.com", company_id=company_id)
    sent = []
    monkeypatch.setattr(
        "app.services.email_service.send_erasure_request_received_email",
        lambda **kwargs: sent.append(kwargs) or True,
    )
    worker_login = client.post("/api/v1/auth/login", data=login_form(worker.email, TEST_SECRET))
    worker_headers = {"Authorization": f"Bearer {worker_login.json()['access_token']}"}

    response = client.post(
        "/api/v1/privacy/requests",
        headers=worker_headers,
        json={"request_type": "access"},
    )
    assert response.status_code == 201
    assert sent == []


def test_other_company_admin_cannot_resolve_an_erasure_request(client, db, monkeypatch):
    first_admin_headers = _register(client, "tenant-a-admin@workhive.com")
    first_company_id = _create_company(client, first_admin_headers)
    worker = _add_worker(db, email="tenant-a-worker@workhive.com", company_id=first_company_id)
    second_admin_headers = _register(client, "tenant-b-admin@workhive.com")
    _create_company(client, second_admin_headers, "-tenant-b")
    monkeypatch.setattr(
        "app.services.email_service.send_erasure_request_received_email",
        lambda **_kwargs: True,
    )
    worker_login = client.post("/api/v1/auth/login", data=login_form(worker.email, TEST_SECRET))
    worker_headers = {"Authorization": f"Bearer {worker_login.json()['access_token']}"}
    created = client.post(
        "/api/v1/privacy/requests",
        headers=worker_headers,
        json={"request_type": "erasure"},
    )

    resolution_email_calls = []
    monkeypatch.setattr(
        "app.services.email_service.send_erasure_request_resolved_email",
        lambda **kwargs: resolution_email_calls.append(kwargs) or True,
    )

    response = client.post(
        f"/api/v1/privacy/requests/{created.json()['id']}/resolve",
        headers=second_admin_headers,
        json={"decision": "complete", "resolution_notes": "Not authorized"},
    )
    assert response.status_code == 404
    assert db.get(User, worker.id).is_active is True
    assert resolution_email_calls == []


def test_erasure_lifecycle_supports_company_review_platform_escalation_and_retention(
    client, db
):
    company_admin_headers = _register(client, "lifecycle-admin@workhive.com")
    company_id = _create_company(client, company_admin_headers, "-lifecycle")
    worker = _add_worker(
        db,
        email="lifecycle-worker@workhive.com",
        company_id=company_id,
    )
    worker_login = client.post(
        "/api/v1/auth/login",
        data=login_form(worker.email, TEST_SECRET),
    )
    assert worker_login.status_code == 200, worker_login.text
    worker_headers = {"Authorization": f"Bearer {worker_login.json()['access_token']}"}

    created = client.post(
        "/api/v1/privacy/requests",
        headers=worker_headers,
        json={
            "request_type": "erasure",
            "reason": "Please erase my account after the company review.",
        },
    )
    assert created.status_code == 201, created.text
    request_id = created.json()["id"]

    company_queue = client.get(
        "/api/v1/privacy/requests",
        headers=company_admin_headers,
    )
    assert company_queue.status_code == 200, company_queue.text
    assert {
        (item["id"], item["company_id"], item["requested_by_user_id"])
        for item in company_queue.json()
    } >= {(request_id, company_id, worker.id)}

    platform_admin = User(
        email="privacy-platform-admin@workhive.com",
        hashed_password=get_password_hash(TEST_SECRET),
        full_name="Privacy Platform Admin",
        role_id=4,
        company_id=None,
        is_active=True,
    )
    db.add(platform_admin)
    db.commit()
    db.refresh(platform_admin)
    platform_login = client.post(
        "/api/v1/auth/login",
        data=login_form(platform_admin.email, TEST_SECRET),
    )
    assert platform_login.status_code == 200, platform_login.text
    platform_headers = {
        "Authorization": f"Bearer {platform_login.json()['access_token']}"
    }

    platform_queue = client.get(
        "/api/v1/privacy/requests",
        headers=platform_headers,
    )
    assert platform_queue.status_code == 200, platform_queue.text
    assert {
        (item["id"], item["company_id"], item["requested_by_user_id"])
        for item in platform_queue.json()
    } >= {(request_id, company_id, worker.id)}

    resolved = client.post(
        f"/api/v1/privacy/requests/{request_id}/resolve",
        headers=platform_headers,
        json={
            "decision": "complete",
            "resolution_notes": "Platform verified the company review and approved erasure.",
        },
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["status"] == "completed"
    assert resolved.json()["resolved_by_user_id"] == platform_admin.id
    assert client.get("/api/v1/users/me", headers=worker_headers).status_code == 401

    db.expire_all()
    anonymized_worker = db.get(User, worker.id)
    assert anonymized_worker is not None
    assert anonymized_worker.email == f"deleted+{worker.id}@invalid.workhive.local"
    assert anonymized_worker.full_name == "Deleted user"
    assert anonymized_worker.is_active is False
    retained_request = db.get(DataSubjectRequest, request_id)
    assert retained_request is not None
    assert retained_request.company_id == company_id
    assert retained_request.requested_by_user_id == worker.id
    assert retained_request.resolved_by_user_id == platform_admin.id

    audit_record = (
        db.query(AuditLog)
        .filter(
            AuditLog.action == "privacy.request_resolved",
            AuditLog.entity_type == "data_subject_request",
            AuditLog.entity_id == str(request_id),
        )
        .one()
    )
    audit_record.ip_address = "203.0.113.8"
    audit_record.created_at = datetime.now(timezone.utc) - timedelta(
        days=settings.AUDIT_IP_RETENTION_DAYS + 1
    )
    db.add(audit_record)
    db.commit()

    first_retention_run = privacy_service.apply_retention_policy(db)
    assert first_retention_run["redacted_audit_ip_addresses"] >= 1
    assert first_retention_run["deleted_resolved_requests"] == 0
    db.expire_all()
    assert db.get(DataSubjectRequest, request_id) is not None
    retained_audit_record = db.get(AuditLog, audit_record.id)
    assert retained_audit_record is not None
    assert retained_audit_record.ip_address is None

    retained_request = db.get(DataSubjectRequest, request_id)
    assert retained_request is not None
    retained_request.resolved_at = datetime.now(timezone.utc) - timedelta(
        days=settings.DATA_SUBJECT_REQUEST_RETENTION_DAYS + 1
    )
    db.add(retained_request)
    db.commit()

    second_retention_run = privacy_service.apply_retention_policy(db)
    assert second_retention_run["deleted_resolved_requests"] == 1
    db.expire_all()
    assert db.get(DataSubjectRequest, request_id) is None
    assert db.get(AuditLog, audit_record.id) is not None
