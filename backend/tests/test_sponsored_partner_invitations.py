from urllib.parse import parse_qs, urlparse

from credentials import TEST_SECRET_A, TEST_SECRET_B, login_form, with_credential
from app.models.company import Company
from app.models.company_collaboration import CompanyCollaboration
from app.models.company_membership import CompanyMembership
from app.models.partner_portal_grant import PartnerPortalGrant
from app.models.privacy_consent import PrivacyConsent
from app.models.user import User


def _register_host(client, *, suffix: str, email: str) -> dict[str, str]:
    registration = client.post(
        "/api/v1/auth/register",
        json=with_credential(
            {
                "email": email,
                "full_name": f"Host admin {suffix}",
                "accept_terms": True,
                "accept_privacy": True,
                "policy_version": "2026-06-15",
            },
            TEST_SECRET_A,
        ),
    )
    assert registration.status_code == 201, registration.text
    login = client.post("/api/v1/auth/login", data=login_form(email, TEST_SECRET_A))
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": f"Host {suffix}",
            "tax_id": f"SPONSOR-{suffix}",
            "address": "Host Street 1",
            "phone": "600000001",
            "email": email,
        },
    )
    assert company.status_code == 201, company.text
    return headers


def _token(delivery: dict[str, object]) -> str:
    return parse_qs(urlparse(str(delivery["invitation_url"])).fragment)["token"][0]


def _accept_payload(delivery: dict[str, object], *, suffix: str) -> dict[str, object]:
    return {
        "token": _token(delivery),
        "verification_code": str(delivery["verification_code"]),
        "company_name": f"Property manager {suffix}",
        "tax_id": f"PORTAL-{suffix}",
        "address": "Property Street 2",
        "postal_code": "17130",
        "city": "L'Escala",
        "province": "Girona",
        "phone": "600000002",
        "full_name": f"Portal owner {suffix}",
        "password": TEST_SECRET_B,
        "accept_terms": True,
        "accept_privacy": True,
        "marketing_consent": False,
    }


def test_sponsored_property_manager_acceptance_creates_only_a_limited_portal(
    client,
    db,
    monkeypatch,
):
    headers = _register_host(client, suffix="accept", email="host-accept@workhive.com")
    delivery: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_sponsored_partner_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )

    created = client.post(
        "/api/v1/collaborations/sponsored-invitations",
        headers=headers,
        json={"email": "manager-accept@workhive.com", "company_name": "Port Blanca"},
    )
    assert created.status_code == 202, created.text
    assert delivery["recipient_email"] == "manager-accept@workhive.com"
    assert "accept-sponsored-partner-invitation#token=" in str(delivery["invitation_url"])

    accepted = client.post(
        "/api/v1/collaborations/sponsored-invitations/accept",
        json=_accept_payload(delivery, suffix="accept"),
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json() == {"status": "accepted"}

    partner = db.query(Company).filter(Company.tax_id == "PORTAL-accept").one()
    portal_user = db.query(User).filter(User.email == "manager-accept@workhive.com").one()
    collaboration = (
        db.query(CompanyCollaboration)
        .filter(CompanyCollaboration.partner_company_id == partner.id)
        .one()
    )
    grant = db.query(PartnerPortalGrant).filter(PartnerPortalGrant.user_id == portal_user.id).one()
    assert partner.subscription_plan == "none"
    assert partner.subscription_status == "inactive"
    assert partner.operating_model == "property_manager"
    assert portal_user.role.name == "partner_portal"
    assert db.query(CompanyMembership).filter(CompanyMembership.user_id == portal_user.id).count() == 0
    assert collaboration.status == "accepted"
    assert collaboration.role_type == "property_manager"
    assert grant.status == "active"
    assert grant.host_company_id == collaboration.initiator_company_id
    assert db.query(PrivacyConsent).filter(PrivacyConsent.user_id == portal_user.id).count() == 3

    login = client.post(
        "/api/v1/auth/login",
        data=login_form("manager-accept@workhive.com", TEST_SECRET_B),
    )
    assert login.status_code == 200, login.text
    portal_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/api/v1/partner-portal/overview", headers=portal_headers).status_code == 200
    assert client.get("/api/v1/locations/", headers=portal_headers).status_code == 402

    collaborations = client.get("/api/v1/collaborations/", headers=headers)
    assert collaborations.status_code == 200, collaborations.text
    assert len(collaborations.json()) == 1
    assert collaborations.json()[0]["partner"]["name"] == "Property manager accept"


def test_sponsored_property_manager_invitation_is_revocable_before_any_company_exists(
    client,
    db,
    monkeypatch,
):
    headers = _register_host(client, suffix="revoke", email="host-revoke@workhive.com")
    delivery: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_sponsored_partner_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )
    created = client.post(
        "/api/v1/collaborations/sponsored-invitations",
        headers=headers,
        json={"email": "manager-revoke@workhive.com", "company_name": "Port Revoke"},
    )
    assert created.status_code == 202, created.text

    sent = client.get(
        "/api/v1/collaborations/sponsored-invitations/sent",
        headers=headers,
    )
    assert sent.status_code == 200, sent.text
    assert sent.json()[0]["status"] == "pending"

    revoked = client.delete(
        f"/api/v1/collaborations/sponsored-invitations/{created.json()['id']}",
        headers=headers,
    )
    assert revoked.status_code == 204, revoked.text
    accepted = client.post(
        "/api/v1/collaborations/sponsored-invitations/accept",
        json=_accept_payload(delivery, suffix="revoke"),
    )
    assert accepted.status_code == 400, accepted.text
    assert db.query(User).filter(User.email == "manager-revoke@workhive.com").count() == 0
    assert db.query(Company).filter(Company.tax_id == "PORTAL-revoke").count() == 0


def test_sponsored_property_manager_cannot_overwrite_an_existing_workhive_account(
    client,
    monkeypatch,
):
    headers = _register_host(client, suffix="existing", email="host-existing@workhive.com")
    existing = client.post(
        "/api/v1/auth/register",
        json=with_credential(
            {
                "email": "already-exists@workhive.com",
                "full_name": "Existing person",
                "accept_terms": True,
                "accept_privacy": True,
                "policy_version": "2026-06-15",
            },
            TEST_SECRET_B,
        ),
    )
    assert existing.status_code == 201, existing.text
    monkeypatch.setattr(
        "app.services.email_service.send_sponsored_partner_invitation_email",
        lambda **kwargs: True,
    )

    response = client.post(
        "/api/v1/collaborations/sponsored-invitations",
        headers=headers,
        json={"email": "already-exists@workhive.com", "company_name": "No overwrite"},
    )
    assert response.status_code == 409, response.text
