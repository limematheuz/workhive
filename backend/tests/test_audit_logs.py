import json

from credentials import TEST_SECRET, login_form, with_credential


def _register_company(client, suffix: str) -> tuple[dict[str, str], int]:
    email = f"audit-{suffix}@workhive.com"
    registration = client.post(
        "/api/v1/auth/register",
        json=with_credential(
            {
                "email": email,
                "full_name": f"Audit {suffix}",
                "accept_terms": True,
                "accept_privacy": True,
                "policy_version": "2026-06-15",
            }
        ),
    )
    assert registration.status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        data=login_form(email),
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        headers={**headers, "X-Request-ID": f"company-{suffix}"},
        json={
            "name": f"Audit Company {suffix}",
            "tax_id": f"AUDIT-{suffix}",
            "address": f"Address {suffix}",
            "phone": "600000000",
            "email": email,
        },
    )
    assert company.status_code == 201, company.text
    return headers, company.json()["id"]


def test_audit_logs_capture_admin_changes_and_are_company_scoped(client, monkeypatch):
    first_headers, first_company_id = _register_company(client, "first")
    monkeypatch.setattr(
        "app.services.email_service.send_worker_invitation_email",
        lambda **_kwargs: True,
    )
    worker = client.post(
        "/api/v1/user-invitations/",
        headers={**first_headers, "X-Request-ID": "worker-created"},
        json={
            "email": "audited-worker@workhive.com",
            "full_name": "Audited Worker",
            "role_id": 3,
        },
    )
    assert worker.status_code == 202, worker.text

    _, second_company_id = _register_company(client, "second")
    assert second_company_id != first_company_id

    response = client.get(
        f"/api/v1/audit-logs/?company_id={second_company_id}",
        headers=first_headers,
    )
    assert response.status_code == 200
    events = response.json()
    assert {event["action"] for event in events} >= {
        "company.created",
        "user.invited",
    }
    assert {event["company_id"] for event in events} == {first_company_id}
    assert {event["request_id"] for event in events} >= {
        "company-first",
        "worker-created",
    }
    assert TEST_SECRET not in json.dumps(events)
