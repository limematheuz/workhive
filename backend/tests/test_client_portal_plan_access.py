import pytest

from app.models.client_portal_invitation import ClientPortalInvitation
from app.models.user import User
from app.services.company_entitlement_service import (
    set_company_entitlement_override,
    synchronize_company_subscription,
)
from credentials import TEST_SECRET_B
from test_client_portal_api import (
    _client,
    _company,
    _grant,
    _internal_user,
    _portal_user,
)


def workspace(db, plan):
    company = _company(db, "plan-access")
    company.subscription_plan = plan
    admin, admin_headers = _internal_user(db, company=company, suffix="plan-access")
    customer = _client(db, company=company, suffix="plan-access")
    user, headers = _portal_user(
        db, email="qa-client-plan@example.com", suffix="plan-access"
    )
    grant = _grant(db, company=company, customer=customer, user=user, admin=admin)
    synchronize_company_subscription(db, company, reason="test.plan-access")
    db.commit()
    return company, customer, grant, headers, admin_headers


@pytest.mark.parametrize("plan", ["basic", "medium", "top", "mega"])
def test_client_portal_requires_the_host_plan_even_with_an_existing_grant(
    client, db, plan
):
    _, _, grant, headers, _ = workspace(db, plan)
    listing = client.get("/api/v1/client-portal/workspaces", headers=headers)
    assert listing.status_code == 200
    enabled = plan != "basic"
    assert len(listing.json()) == int(enabled)
    response = client.get(
        f"/api/v1/client-portal/workspaces/{grant.id}/overview", headers=headers
    )
    assert response.status_code == (200 if enabled else 403), response.text
    if not enabled:
        assert (
            response.headers["X-WorkHive-Error-Code"]
            == "entitlement.feature_not_in_plan"
        )


@pytest.mark.parametrize("base,override", [("basic", True), ("top", False)])
def test_client_portal_respects_custom_feature_grants_and_removal(
    client, db, base, override
):
    company, _, grant, headers, _ = workspace(db, base)
    set_company_entitlement_override(
        db,
        company_id=company.id,
        code="features.client_portal",
        value=override,
        reason="QA contract exception",
        actor_user_id=None,
    )
    db.commit()
    assert len(
        client.get("/api/v1/client-portal/workspaces", headers=headers).json()
    ) == int(override)
    assert client.get(
        f"/api/v1/client-portal/workspaces/{grant.id}/overview", headers=headers
    ).status_code == (200 if override else 403)


def test_basic_cannot_send_a_client_portal_invitation(client, db, monkeypatch):
    _, customer, _, _, admin_headers = workspace(db, "basic")
    sent = []
    monkeypatch.setattr(
        "app.services.email_service.send_client_portal_invitation_email",
        lambda **kw: sent.append(kw) or True,
    )
    response = client.post(
        f"/api/v1/client-portal/clients/{customer.id}/invitations",
        headers=admin_headers,
        json={"email": "new-portal@example.com"},
    )
    assert response.status_code == 403, response.text
    assert sent == []
    assert db.query(ClientPortalInvitation).count() == 0


def test_downgrade_prevents_accepting_a_previously_sent_portal_invitation(
    client, db, monkeypatch
):
    company, customer, _, _, admin_headers = workspace(db, "top")
    delivery = {}
    monkeypatch.setattr(
        "app.services.email_service.send_client_portal_invitation_email",
        lambda **kw: delivery.update(kw) or True,
    )
    response = client.post(
        f"/api/v1/client-portal/clients/{customer.id}/invitations",
        headers=admin_headers,
        json={"email": "new-portal@example.com"},
    )
    assert response.status_code == 201, response.text
    company.subscription_plan = "basic"
    synchronize_company_subscription(db, company, reason="test.downgrade")
    db.commit()
    accepted = client.post(
        "/api/v1/client-portal/invitations/accept",
        json={
            "token": str(delivery["invitation_url"]).split("#token=", 1)[1],
            "verification_code": delivery["verification_code"],
            "full_name": "QA portal",
            "password": TEST_SECRET_B,
            "accept_terms": True,
            "accept_privacy": True,
        },
    )
    assert accepted.status_code == 403, accepted.text
    assert db.query(User).filter_by(email="new-portal@example.com").count() == 0
    assert db.query(ClientPortalInvitation).one().status == "pending"
