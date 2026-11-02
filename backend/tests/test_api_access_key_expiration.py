from datetime import datetime, timedelta, timezone

import pytest

from app.models.api_access_key import ApiAccessKey
from app.models.audit_log import AuditLog
from test_public_api_access import _company, _user


@pytest.mark.parametrize(
    "expiry", ["2099-01-01T09:00:00", "2099-01-01", "2020-01-01T00:00:00Z"]
)
def test_invalid_expiration_is_rejected_without_issuing_or_auditing_key(
    client, db, expiry
):
    company = _company(db, "EXPIRATION-INVALID")
    _, headers = _user(
        db, company=company, role_name="admin", suffix="EXPIRATION-INVALID"
    )
    db.commit()
    response = client.post(
        "/api/v1/api-access-keys/",
        headers=headers,
        json={
            "name": "Invalid expiration",
            "scopes": ["work_orders.read"],
            "expires_at": expiry,
        },
    )
    assert response.status_code == 422, response.text
    assert db.query(ApiAccessKey).filter_by(company_id=company.id).count() == 0
    assert (
        db.query(AuditLog)
        .filter_by(company_id=company.id, action="api_access_key.created")
        .count()
        == 0
    )


@pytest.mark.parametrize("offset_minutes", [0, 345, -420])
def test_expiration_offset_keeps_the_same_instant_and_expires_closed(
    client, db, monkeypatch, offset_minutes
):
    from app.services import api_access_key_service

    company = _company(db, f"EXPIRATION-{offset_minutes}")
    _, headers = _user(
        db, company=company, role_name="admin", suffix=f"EXPIRATION-{offset_minutes}"
    )
    db.commit()
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).replace(microsecond=0)
    response = client.post(
        "/api/v1/api-access-keys/",
        headers=headers,
        json={
            "name": "Timezone expiration",
            "scopes": ["work_orders.read"],
            "expires_at": expires.astimezone(
                timezone(timedelta(minutes=offset_minutes))
            ).isoformat(),
        },
    )
    assert response.status_code == 201
    body = response.json()
    key = db.get(ApiAccessKey, body["id"])
    assert key.expires_at.replace(tzinfo=timezone.utc) == expires
    public_headers = {"X-WorkHive-API-Key": body["api_key"]}
    assert (
        client.get("/api/v1/public/work-orders", headers=public_headers).status_code
        == 200
    )
    monkeypatch.setattr(api_access_key_service, "utcnow", lambda: expires)
    assert (
        client.get("/api/v1/public/work-orders", headers=public_headers).status_code
        == 401
    )
    listing = client.get("/api/v1/api-access-keys/", headers=headers)
    assert listing.status_code == 200
    assert all(
        "api_key" not in item and "key_hash" not in item for item in listing.json()
    )
    audits = db.query(AuditLog).filter_by(company_id=company.id).all()
    assert body["api_key"] not in str([event.details for event in audits])


@pytest.mark.parametrize("role", ["manager", "viewer"])
def test_expiration_does_not_bypass_admin_only_key_creation(client, db, role):
    company = _company(db, f"EXPIRATION-DENIED-{role}")
    _, headers = _user(
        db, company=company, role_name=role, suffix=f"EXPIRATION-DENIED-{role}"
    )
    db.commit()
    response = client.post(
        "/api/v1/api-access-keys/",
        headers=headers,
        json={
            "name": "Unauthorized",
            "scopes": ["work_orders.read"],
            "expires_at": "2099-01-01T00:00:00Z",
        },
    )
    assert response.status_code == 403
    assert db.query(ApiAccessKey).filter_by(company_id=company.id).count() == 0
