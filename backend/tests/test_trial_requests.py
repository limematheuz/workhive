from credentials import TEST_SUPER, login_form
from app.core.config import settings
from app.core.rate_limit import rate_limiter
from app.core.security import get_password_hash
from app.models.trial_request import TrialRequest
from app.models.company import Company
from app.models.user import User


def _superadmin_headers(client, db) -> dict[str, str]:
    superadmin = User(
        email="trial-superadmin@workhive.com",
        hashed_password=get_password_hash(TEST_SUPER),
        full_name="WorkHive Admin",
        role_id=4,
        company_id=None,
        is_active=True,
    )
    db.add(superadmin)
    db.commit()
    login = client.post(
        "/api/v1/auth/login",
        data=login_form(superadmin.email, TEST_SUPER),
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_trial_request_requires_email_verification_before_approval(client, db, monkeypatch):
    delivered = {}

    def capture_verification(**kwargs):
        delivered["verification_url"] = kwargs["verification_url"]
        return True

    monkeypatch.setattr(
        "app.services.email_service.send_trial_verification_email",
        capture_verification,
    )

    response = client.post(
        "/api/v1/trial-requests/",
        json={
            "full_name": "Ana Trial",
            "email": "ana.trial@example.com",
            "company_name": "Ana Services",
            "phone": "600000000",
            "message": "Quiero probar WorkHive",
        },
    )
    assert response.status_code == 202

    headers = _superadmin_headers(client, db)
    trial_request = db.query(TrialRequest).filter_by(email="ana.trial@example.com").one()
    blocked = client.post(
        f"/api/v1/trial-requests/{trial_request.id}/approve",
        headers=headers,
        json={
            "access_mode": "trial",
            "trial_days": 14,
            "tax_id": "B11111111",
            "address": "Calle Trial 1",
            "phone": "600000000",
        },
    )
    assert blocked.status_code == 409

    token = delivered["verification_url"].split("trial_verification=", 1)[1]
    verified = client.post("/api/v1/trial-requests/verify", json={"token": token})
    assert verified.status_code == 200
    assert verified.json()["status"] == "email_verified"


def test_superadmin_can_approve_verified_trial_request(client, db, monkeypatch):
    delivered = {}

    monkeypatch.setattr(
        "app.services.email_service.send_trial_verification_email",
        lambda **kwargs: delivered.setdefault("verification_url", kwargs["verification_url"]) or True,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_trial_approved_email",
        lambda **kwargs: delivered.setdefault("setup_url", kwargs["setup_url"]) or True,
    )

    client.post(
        "/api/v1/trial-requests/",
        json={
            "full_name": "Bruno Owner",
            "email": "bruno@example.com",
            "company_name": "Bruno Clean",
            "phone": "611111111",
            "message": "Necesito acceso",
        },
    )
    token = delivered["verification_url"].split("trial_verification=", 1)[1]
    client.post("/api/v1/trial-requests/verify", json={"token": token})

    headers = _superadmin_headers(client, db)
    trial_request = db.query(TrialRequest).filter_by(email="bruno@example.com").one()
    approved = client.post(
        f"/api/v1/trial-requests/{trial_request.id}/approve",
        headers=headers,
        json={
            "access_mode": "trial",
            "trial_days": 30,
            "tax_id": "B22222222",
            "address": "Calle Pro 2",
            "phone": "611111111",
        },
    )

    assert approved.status_code == 200
    data = approved.json()
    assert data["status"] == "approved"
    assert data["approval_mode"] == "trial"
    assert data["approved_trial_days"] == 30
    assert data["created_company_id"] is not None
    assert data["created_user_id"] is not None
    assert "setup_url" in delivered
    company = db.get(Company, data["created_company_id"])
    assert company.subscription_plan == "top"
    assert company.subscription_status == "trialing"


def test_superadmin_can_approve_verified_request_with_enterprise_plan(client, db, monkeypatch):
    delivered = {}

    monkeypatch.setattr(
        "app.services.email_service.send_trial_verification_email",
        lambda **kwargs: delivered.setdefault("verification_url", kwargs["verification_url"]) or True,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_trial_approved_email",
        lambda **kwargs: delivered.setdefault("access_mode", kwargs["access_mode"]) or True,
    )

    client.post(
        "/api/v1/trial-requests/",
        json={
            "full_name": "Enterprise Owner",
            "email": "enterprise.owner@example.com",
            "company_name": "Enterprise Clean",
            "phone": "622222222",
        },
    )
    token = delivered["verification_url"].split("trial_verification=", 1)[1]
    client.post("/api/v1/trial-requests/verify", json={"token": token})

    headers = _superadmin_headers(client, db)
    trial_request = db.query(TrialRequest).filter_by(email="enterprise.owner@example.com").one()
    approved = client.post(
        f"/api/v1/trial-requests/{trial_request.id}/approve",
        headers=headers,
        json={
            "access_mode": "mega",
            "tax_id": "B33333333",
            "address": "Enterprise Street 3",
            "phone": "622222222",
        },
    )

    assert approved.status_code == 200
    data = approved.json()
    assert data["approval_mode"] == "mega"
    assert data["approved_trial_days"] is None
    company = db.get(Company, data["created_company_id"])
    assert company.subscription_plan == "mega"
    assert company.subscription_status == "active"
    assert delivered["access_mode"] == "mega"


def test_trial_verification_is_rate_limited(client, monkeypatch):
    monkeypatch.setattr(settings, "TRIAL_VERIFICATION_RATE_LIMIT", 1)
    with rate_limiter._lock:
        rate_limiter._attempts.clear()

    first = client.post(
        "/api/v1/trial-requests/verify",
        json={"token": "a" * 32},
    )
    second = client.post(
        "/api/v1/trial-requests/verify",
        json={"token": "b" * 32},
    )

    assert first.status_code == 404
    assert second.status_code == 429
