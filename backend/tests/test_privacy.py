from app.core.security import get_password_hash
from app.models.user import User
from credentials import TEST_NEW, TEST_OLD, TEST_SECRET, login_form, with_credential, with_new_credential, CREDENTIAL_FIELD


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


def _create_company(client, headers: dict[str, str]) -> int:
    response = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": "Privacy Company",
            "tax_id": "PRIVACY-001",
            "address": "Privacy Street 1",
            "phone": "600000001",
            "email": "privacy-company@workhive.com",
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

    revoked = client.get("/api/v1/users/me", headers=worker_headers)
    assert revoked.status_code == 401

    users = client.get("/api/v1/users/", headers=admin_headers)
    assert users.status_code == 200
    assert all(item["id"] != worker_id for item in users.json())


def test_last_company_admin_erasure_deactivates_company(client):
    admin_headers = _register(client, "last-admin@workhive.com")
    _create_company(client, admin_headers)
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

    revoked = client.get("/api/v1/users/me", headers=admin_headers)
    assert revoked.status_code == 401

    blocked_login = client.post(
        "/api/v1/auth/login",
        data=login_form("last-admin@workhive.com", TEST_SECRET),
    )
    assert blocked_login.status_code == 402
