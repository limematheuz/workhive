from credentials import CREDENTIAL_FIELD, TEST_SECRET, login_form

from app.core.security import create_access_token
from app.models.client import Client
from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.user import User
from app.services import organization_bootstrap_service


def _admin_headers(client, suffix: str) -> dict[str, str]:
    email = f"client-opportunities-{suffix}@workhive.com"
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": f"Commercial admin {suffix}",
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
            "name": f"Commercial account {suffix}",
            "tax_id": f"OPPORTUNITY-{suffix}",
            "address": "Calle Comercial 5",
            "phone": "600001200",
            "email": f"admin-{suffix}@opportunities.com",
        },
    )
    assert company.status_code == 201, company.text
    return headers


def _lead_payload(name: str) -> dict[str, object]:
    return {
        "name": name,
        "client_type": "company",
        "relationship_status": "lead",
        "address": "Avenida Comercial 3",
        "city": "Madrid",
        "postal_code": "28003",
        "country": "España",
    }


def test_client_opportunities_keep_sales_context_and_an_activity_history(client):
    headers = _admin_headers(client, "history")
    created_client = client.post(
        "/api/v1/clients/", headers=headers, json=_lead_payload("Prospecto comercial")
    )
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]

    contact = client.post(
        f"/api/v1/clients/{client_id}/contacts",
        headers=headers,
        json={"full_name": "Ana Compras", "roles": ["commercial"]},
    )
    assert contact.status_code == 201, contact.text

    owners = client.get(f"/api/v1/clients/{client_id}/opportunity-owners", headers=headers)
    assert owners.status_code == 200, owners.text
    assert len(owners.json()) == 1
    owner_id = owners.json()[0]["membership_id"]

    created = client.post(
        f"/api/v1/clients/{client_id}/opportunities",
        headers=headers,
        json={
            "title": "Renovación del servicio de limpieza",
            "stage": "qualified",
            "contact_id": contact.json()["id"],
            "owner_membership_id": owner_id,
            "next_follow_up_at": "2026-09-10T09:30:00Z",
        },
    )
    assert created.status_code == 201, created.text
    opportunity = created.json()
    assert opportunity["stage"] == "qualified"
    assert opportunity["owner_membership_id"] == owner_id
    assert opportunity["owner_name"] == "Commercial admin history"

    missing_reason = client.patch(
        f"/api/v1/clients/{client_id}/opportunities/{opportunity['id']}",
        headers=headers,
        json={"stage": "lost"},
    )
    assert missing_reason.status_code == 422
    assert "loss reason" in missing_reason.json()["detail"]

    marked_lost = client.patch(
        f"/api/v1/clients/{client_id}/opportunities/{opportunity['id']}",
        headers=headers,
        json={"stage": "lost", "loss_reason": "El cliente pospone la decisión"},
    )
    assert marked_lost.status_code == 200, marked_lost.text
    assert marked_lost.json()["loss_reason"] == "El cliente pospone la decisión"

    note = client.post(
        f"/api/v1/clients/{client_id}/opportunities/{opportunity['id']}/activities",
        headers=headers,
        json={"activity_type": "call", "body": "Llamada de seguimiento acordada."},
    )
    assert note.status_code == 201, note.text

    activities = client.get(
        f"/api/v1/clients/{client_id}/opportunities/{opportunity['id']}/activities",
        headers=headers,
    )
    assert activities.status_code == 200, activities.text
    assert [activity["activity_type"] for activity in activities.json()] == [
        "call",
        "stage_change",
    ]
    assert activities.json()[1]["stage_from"] == "qualified"
    assert activities.json()[1]["stage_to"] == "lost"


def test_client_opportunities_enforce_tenant_owner_and_write_boundaries(client, db):
    owner_headers = _admin_headers(client, "owner")
    outsider_headers = _admin_headers(client, "outsider")
    created_client = client.post(
        "/api/v1/clients/", headers=owner_headers, json=_lead_payload("Prospecto privado")
    )
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]

    outsider_owner = client.get(
        f"/api/v1/clients/{client_id}/opportunity-owners", headers=outsider_headers
    )
    assert outsider_owner.status_code == 404

    created = client.post(
        f"/api/v1/clients/{client_id}/opportunities",
        headers=owner_headers,
        json={"title": "Cuenta protegida"},
    )
    assert created.status_code == 201, created.text
    opportunity_id = created.json()["id"]

    foreign_list = client.get(
        f"/api/v1/clients/{client_id}/opportunities", headers=outsider_headers
    )
    foreign_create = client.post(
        f"/api/v1/clients/{client_id}/opportunities/{opportunity_id}/activities",
        headers=outsider_headers,
        json={"activity_type": "note", "body": "No permitido"},
    )
    assert foreign_list.status_code == 404
    assert foreign_create.status_code == 404

    outsider_user = (
        db.query(User)
        .filter(User.email == "client-opportunities-outsider@workhive.com")
        .one()
    )
    outsider_membership = (
        db.query(CompanyMembership)
        .filter(CompanyMembership.user_id == outsider_user.id)
        .one()
    )
    invalid_owner = client.post(
        f"/api/v1/clients/{client_id}/opportunities",
        headers=owner_headers,
        json={
            "title": "Responsable de otra empresa",
            "owner_membership_id": outsider_membership.id,
        },
    )
    assert invalid_owner.status_code == 422

    company = Company(
        name="Opportunity viewer company",
        tax_id="OPPORTUNITY-VIEWER",
        address="Calle Comercial 6",
        phone="600001201",
        email="opportunity-viewer@example.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.flush()
    prospect = Client(
        company_id=company.id,
        name="Opportunity viewer prospect",
        client_type="company",
        relationship_status="lead",
        address="Calle Comercial 7",
        city="Madrid",
        postal_code="28004",
        country="España",
    )
    viewer = User(
        email="opportunity-viewer@example.test",
        hashed_password="unused",
        full_name="Opportunity viewer",
        role_id=3,
        company_id=company.id,
    )
    db.add_all([prospect, viewer])
    db.flush()
    organization_bootstrap_service.ensure_user_membership(db, viewer)
    db.commit()
    viewer_headers = {
        "Authorization": f"Bearer {create_access_token({'sub': viewer.email, 'ver': viewer.session_version})}"
    }

    readable = client.get(
        f"/api/v1/clients/{prospect.id}/opportunities", headers=viewer_headers
    )
    owners_for_viewer = client.get(
        f"/api/v1/clients/{prospect.id}/opportunity-owners", headers=viewer_headers
    )
    blocked = client.post(
        f"/api/v1/clients/{prospect.id}/opportunities",
        headers=viewer_headers,
        json={"title": "No permitido"},
    )
    assert readable.status_code == 200, readable.text
    assert readable.json() == []
    assert owners_for_viewer.status_code == 403
    assert blocked.status_code == 403
