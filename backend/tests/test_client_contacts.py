from credentials import CREDENTIAL_FIELD, TEST_SECRET, login_form

from app.core.security import create_access_token
from app.models.client import Client
from app.models.company import Company
from app.models.user import User


def _admin_headers(client, suffix: str) -> dict[str, str]:
    email = f"client-contacts-{suffix}@workhive.com"
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": f"Client contacts {suffix}",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    assert registered.status_code == 201, registered.text
    login = client.post("/api/v1/auth/login", data=login_form(email, TEST_SECRET))
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": f"Client contacts {suffix}",
            "tax_id": f"CONTACT-{suffix}",
            "address": "Calle Contactos 1",
            "phone": "600001100",
            "email": f"admin-{suffix}@contacts.com",
        },
    )
    assert company.status_code == 201, company.text
    return headers


def _client_payload(name: str) -> dict[str, object]:
    return {
        "name": name,
        "client_type": "company",
        "relationship_status": "lead",
        "address": "Avenida Comercial 2",
        "city": "Madrid",
        "postal_code": "28001",
        "country": "España",
    }


def test_client_contacts_keep_one_primary_and_multiple_responsibilities(client):
    headers = _admin_headers(client, "primary")
    created_client = client.post(
        "/api/v1/clients/", headers=headers, json=_client_payload("Prospecto Uno")
    )
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]
    assert created_client.json()["relationship_status"] == "lead"

    first = client.post(
        f"/api/v1/clients/{client_id}/contacts",
        headers=headers,
        json={
            "full_name": "Ana Comercial",
            "email": "ana@example.com",
            "roles": ["billing", "commercial"],
            "is_primary": True,
        },
    )
    assert first.status_code == 201, first.text
    assert first.json()["roles"] == ["billing", "commercial"]
    assert first.json()["is_primary"] is True

    second = client.post(
        f"/api/v1/clients/{client_id}/contacts",
        headers=headers,
        json={
            "full_name": "Bruno Operaciones",
            "phone": "600 001 101",
            "roles": ["operations", "quality"],
            "is_primary": True,
        },
    )
    assert second.status_code == 201, second.text
    second_id = second.json()["id"]

    contacts = client.get(f"/api/v1/clients/{client_id}/contacts", headers=headers)
    assert contacts.status_code == 200, contacts.text
    assert [contact["full_name"] for contact in contacts.json()] == [
        "Bruno Operaciones",
        "Ana Comercial",
    ]
    assert [contact["is_primary"] for contact in contacts.json()] == [True, False]

    deactivated = client.delete(
        f"/api/v1/clients/{client_id}/contacts/{second_id}", headers=headers
    )
    assert deactivated.status_code == 200, deactivated.text
    assert deactivated.json()["is_active"] is False
    assert deactivated.json()["is_primary"] is False


def test_client_contacts_validate_primary_state_and_scope_every_request(client):
    owner_headers = _admin_headers(client, "owner")
    outsider_headers = _admin_headers(client, "outsider")
    created_client = client.post(
        "/api/v1/clients/", headers=owner_headers, json=_client_payload("Prospecto Dos")
    )
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]

    invalid = client.post(
        f"/api/v1/clients/{client_id}/contacts",
        headers=owner_headers,
        json={"full_name": "Inactivo", "is_primary": True, "is_active": False},
    )
    assert invalid.status_code == 422
    assert "inactive contact" in invalid.json()["detail"]

    created_contact = client.post(
        f"/api/v1/clients/{client_id}/contacts",
        headers=owner_headers,
        json={"full_name": "Contacto propio", "roles": ["general"]},
    )
    assert created_contact.status_code == 201, created_contact.text
    contact_id = created_contact.json()["id"]

    foreign_list = client.get(
        f"/api/v1/clients/{client_id}/contacts", headers=outsider_headers
    )
    assert foreign_list.status_code == 404

    foreign_update = client.patch(
        f"/api/v1/clients/{client_id}/contacts/{contact_id}",
        headers=outsider_headers,
        json={"full_name": "No permitido"},
    )
    assert foreign_update.status_code == 404

    duplicate_roles = client.patch(
        f"/api/v1/clients/{client_id}/contacts/{contact_id}",
        headers=owner_headers,
        json={"roles": ["commercial", "commercial"]},
    )
    assert duplicate_roles.status_code == 422


def test_client_contacts_require_an_assigned_client_profile(client, db):
    company = Company(
        name="Contact authorization",
        tax_id="CONTACT-AUTH",
        address="Calle Contactos 4",
        phone="600001102",
        email="contacts-auth@example.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.flush()
    prospect = Client(
        company_id=company.id,
        name="Prospecto protegido",
        client_type="company",
        relationship_status="lead",
        address="Calle Comercial 4",
        city="Madrid",
        postal_code="28002",
        country="España",
    )
    viewer = User(
        email="contact-viewer@example.test",
        hashed_password="unused",
        full_name="Contact viewer",
        role_id=3,
        company_id=company.id,
    )
    db.add_all([prospect, viewer])
    db.commit()
    headers = {
        "Authorization": f"Bearer {create_access_token({'sub': viewer.email, 'ver': viewer.session_version})}"
    }

    readable = client.get(
        f"/api/v1/clients/{prospect.id}/contacts", headers=headers
    )
    blocked = client.post(
        f"/api/v1/clients/{prospect.id}/contacts",
        headers=headers,
        json={"full_name": "No permitido"},
    )

    assert readable.status_code == 403, readable.text
    assert blocked.status_code == 403


def test_contact_rejects_null_required_fields_and_preserves_responsibilities(client):
    headers = _admin_headers(client, "required")
    created_client = client.post("/api/v1/clients/", headers=headers, json=_client_payload("QA required"))
    assert created_client.status_code == 201, created_client.text
    base = f"/api/v1/clients/{created_client.json()['id']}/contacts"
    created = client.post(base, headers=headers, json={"full_name": "QA Billing", "roles": ["billing"], "phone": "000000000", "is_primary": True})
    assert created.status_code == 201, created.text
    original = created.json()
    url = f"{base}/{original['id']}"
    for field in ("full_name", "is_active", "is_primary", "roles"):
        rejected = client.patch(url, headers=headers, json={field: None, "phone": "must not persist"})
        assert rejected.status_code == 422, (field, rejected.text)
        assert client.get(base, headers=headers).json() == [original]
    for name in ("", "   "):
        assert client.patch(url, headers=headers, json={"full_name": name}).status_code == 422
    updated = client.patch(url, headers=headers, json={"phone": None, "email": None, "job_title": None, "roles": [], "is_primary": False})
    assert updated.status_code == 200, updated.text
    assert updated.json()["full_name"] == original["full_name"]
    assert updated.json()["roles"] == []
    assert updated.json()["phone"] is None
