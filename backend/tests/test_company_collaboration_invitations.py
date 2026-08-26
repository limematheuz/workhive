from urllib.parse import parse_qs, urlparse

from credentials import TEST_SECRET_A, TEST_SECRET_B, login_form, with_credential
from app.models.user import User


def _register_company(client, *, suffix: str, email: str, secret: str) -> dict[str, str]:
    registration = client.post(
        "/api/v1/auth/register",
        json=with_credential(
            {
                "email": email,
                "full_name": f"Company admin {suffix}",
                "accept_terms": True,
                "accept_privacy": True,
                "policy_version": "2026-06-15",
            },
            secret,
        ),
    )
    assert registration.status_code == 201, registration.text
    login = client.post("/api/v1/auth/login", data=login_form(email, secret))
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": f"Company {suffix}",
            "tax_id": f"COLLAB-{suffix}",
            "address": "Invitation Street 1",
            "phone": "600000000",
            "email": email,
        },
    )
    assert company.status_code == 201, company.text
    return headers


def _invitation_token(delivery: dict[str, object]) -> str:
    return parse_qs(urlparse(str(delivery["invitation_url"])).fragment)["token"][0]


def _accept_payload(delivery: dict[str, object]) -> dict[str, str]:
    return {
        "token": _invitation_token(delivery),
        "verification_code": str(delivery["verification_code"]),
    }


def test_company_email_invitation_creates_a_cross_company_relation_only_after_acceptance(
    client, monkeypatch
):
    inviter_headers = _register_company(
        client,
        suffix="inviter",
        email="inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    partner_headers = _register_company(
        client,
        suffix="partner",
        email="partner@workhive.com",
        secret=TEST_SECRET_B,
    )
    delivery: dict[str, object] = {}
    decisions: list[dict[str, object]] = []
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_decision_email",
        lambda **kwargs: decisions.append(kwargs) or True,
    )

    created = client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "partner@workhive.com", "role_type": "service_provider"},
    )
    assert created.status_code == 202, created.text
    assert delivery["recipient_email"] == "partner@workhive.com"
    assert delivery["role_type"] == "service_provider"
    assert "#token=" in str(delivery["invitation_url"])
    assert len(str(delivery["verification_code"])) == 10
    assert client.get("/api/v1/collaborations/", headers=inviter_headers).json() == []

    accepted = client.post(
        "/api/v1/collaborations/invitations/accept",
        headers=partner_headers,
        json=_accept_payload(delivery),
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "accepted"
    assert {item["recipient_email"] for item in decisions} == {
        "inviter@workhive.com",
        "partner@workhive.com",
    }
    assert any(
        item["event_type"] == "company_collaboration.invitation_accepted"
        for item in client.get("/api/v1/notifications/", headers=inviter_headers).json()
    )
    assert any(
        item["event_type"] == "company_collaboration.invitation_accepted"
        for item in client.get("/api/v1/notifications/", headers=partner_headers).json()
    )
    assert len(client.get("/api/v1/collaborations/", headers=inviter_headers).json()) == 1


def test_company_email_invitation_requires_the_invited_company_admin(client, monkeypatch):
    inviter_headers = _register_company(
        client,
        suffix="email-owner",
        email="email-owner@workhive.com",
        secret=TEST_SECRET_A,
    )
    other_headers = _register_company(
        client,
        suffix="other",
        email="other-admin@workhive.com",
        secret=TEST_SECRET_B,
    )
    delivery: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_decision_email",
        lambda **kwargs: True,
    )
    assert client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "expected-admin@workhive.com", "role_type": "property_manager"},
    ).status_code == 202

    response = client.post(
        "/api/v1/collaborations/invitations/accept",
        headers=other_headers,
        json=_accept_payload(delivery),
    )
    assert response.status_code == 403


def test_company_email_invitation_checks_the_signed_in_admin_before_verification(client, monkeypatch):
    inviter_headers = _register_company(
        client,
        suffix="access-check-inviter",
        email="access-check-inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    invited_headers = _register_company(
        client,
        suffix="access-check-invited",
        email="access-check-invited@workhive.com",
        secret=TEST_SECRET_B,
    )
    delivery: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )

    assert client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "access-check-invited@workhive.com"},
    ).status_code == 202

    response = client.post(
        "/api/v1/collaborations/invitations/verify-access",
        headers=invited_headers,
        json={"token": _invitation_token(delivery)},
    )
    assert response.status_code == 204, response.text


def test_company_email_invitation_never_overwrites_a_pending_relationship(client, monkeypatch):
    inviter_headers = _register_company(
        client,
        suffix="duplicate-inviter",
        email="duplicate-inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    deliveries: list[dict[str, object]] = []
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: deliveries.append(kwargs) or True,
    )

    first = client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "duplicate-partner@workhive.com", "role_type": "service_provider"},
    )
    assert first.status_code == 202, first.text

    duplicate = client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "duplicate-partner@workhive.com", "role_type": "property_manager"},
    )
    assert duplicate.status_code == 409
    assert "pending invitation" in duplicate.json()["detail"]
    assert len(deliveries) == 1

    sent = client.get("/api/v1/collaborations/invitations/sent", headers=inviter_headers)
    assert sent.status_code == 200
    assert len(sent.json()) == 1
    assert sent.json()[0]["role_type"] == "service_provider"


def test_company_email_invitation_can_be_revoked_before_acceptance(client, monkeypatch):
    inviter_headers = _register_company(
        client,
        suffix="revoke-inviter",
        email="revoke-inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    partner_headers = _register_company(
        client,
        suffix="revoke-partner",
        email="revoke-partner@workhive.com",
        secret=TEST_SECRET_B,
    )
    delivery: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_decision_email",
        lambda **kwargs: True,
    )
    created = client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "revoke-partner@workhive.com", "role_type": "service_provider"},
    )
    assert created.status_code == 202

    revoked = client.delete(
        f"/api/v1/collaborations/invitations/{created.json()['id']}",
        headers=inviter_headers,
    )
    assert revoked.status_code == 204
    accepted = client.post(
        "/api/v1/collaborations/invitations/accept",
        headers=partner_headers,
        json=_accept_payload(delivery),
    )
    assert accepted.status_code == 400


def test_company_email_invitation_requires_the_email_verification_code(client, monkeypatch):
    inviter_headers = _register_company(
        client,
        suffix="code-inviter",
        email="code-inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    partner_headers = _register_company(
        client,
        suffix="code-partner",
        email="code-partner@workhive.com",
        secret=TEST_SECRET_B,
    )
    delivery: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_decision_email",
        lambda **kwargs: True,
    )
    assert client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "code-partner@workhive.com"},
    ).status_code == 202

    rejected_code = client.post(
        "/api/v1/collaborations/invitations/accept",
        headers=partner_headers,
        json={"token": _invitation_token(delivery), "verification_code": "WRONGCODE1"},
    )
    assert rejected_code.status_code == 400
    assert client.get("/api/v1/collaborations/", headers=inviter_headers).json() == []


def test_company_email_invitation_can_be_declined_and_notifies_both_companies(client, monkeypatch):
    inviter_headers = _register_company(
        client,
        suffix="decline-inviter",
        email="decline-inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    partner_headers = _register_company(
        client,
        suffix="decline-partner",
        email="decline-partner@workhive.com",
        secret=TEST_SECRET_B,
    )
    delivery: dict[str, object] = {}
    decisions: list[dict[str, object]] = []
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_decision_email",
        lambda **kwargs: decisions.append(kwargs) or True,
    )
    assert client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "decline-partner@workhive.com"},
    ).status_code == 202

    response = client.post(
        "/api/v1/collaborations/invitations/decline",
        headers=partner_headers,
        json=_accept_payload(delivery),
    )
    assert response.status_code == 204, response.text
    assert {item["recipient_email"] for item in decisions} == {
        "decline-inviter@workhive.com",
        "decline-partner@workhive.com",
    }
    assert client.get("/api/v1/collaborations/", headers=inviter_headers).json() == []


def test_new_company_can_activate_directly_from_a_valid_invitation(client, monkeypatch):
    inviter_headers = _register_company(
        client,
        suffix="activation-inviter",
        email="activation-inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    delivery: dict[str, object] = {}
    decisions: list[dict[str, object]] = []
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_decision_email",
        lambda **kwargs: decisions.append(kwargs) or True,
    )
    assert client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "new-company-admin@workhive.com", "role_type": "property_manager"},
    ).status_code == 202

    payload = _accept_payload(delivery)
    status_response = client.post(
        "/api/v1/collaborations/invitations/activation-status",
        json={"token": payload["token"]},
    )
    assert status_response.status_code == 200, status_response.text
    assert status_response.json() == {"mode": "create_account"}

    rejected_code = client.post(
        "/api/v1/collaborations/invitations/activate",
        json={
            **payload,
            "verification_code": "WRONGCODE1",
            "full_name": "New company admin",
            "company_name": "New partner company",
            "tax_id": "ACTIVATION-NEW",
            "address": "Partner Street 2",
            "phone": "600000002",
            "password": TEST_SECRET_B,
            "accept_terms": True,
            "accept_privacy": True,
        },
    )
    assert rejected_code.status_code == 400, rejected_code.text

    activated = client.post(
        "/api/v1/collaborations/invitations/activate",
        json={
            **payload,
            "full_name": "New company admin",
            "company_name": "New partner company",
            "tax_id": "ACTIVATION-NEW",
            "address": "Partner Street 2",
            "phone": "600000002",
            "password": TEST_SECRET_B,
            "accept_terms": True,
            "accept_privacy": True,
        },
    )
    assert activated.status_code == 201, activated.text
    assert activated.json() == {"status": "accepted"}
    assert {item["recipient_email"] for item in decisions} == {
        "activation-inviter@workhive.com",
        "new-company-admin@workhive.com",
    }

    login = client.post(
        "/api/v1/auth/login",
        data=login_form("new-company-admin@workhive.com", TEST_SECRET_B),
    )
    assert login.status_code == 200, login.text
    new_company_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    collaborations = client.get("/api/v1/collaborations/", headers=new_company_headers)
    assert collaborations.status_code == 200, collaborations.text
    assert collaborations.json()[0]["role_type"] == "property_manager"


def test_existing_companyless_account_can_finish_company_invitation_after_sign_in(client, monkeypatch):
    inviter_headers = _register_company(
        client,
        suffix="existing-account-inviter",
        email="existing-account-inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    delivery: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_decision_email",
        lambda **kwargs: True,
    )
    assert client.post(
        "/api/v1/auth/register",
        json=with_credential(
            {
                "email": "companyless@workhive.com",
                "full_name": "Companyless user",
                "accept_terms": True,
                "accept_privacy": True,
                "policy_version": "2026-06-15",
            },
            TEST_SECRET_B,
        ),
    ).status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        data=login_form("companyless@workhive.com", TEST_SECRET_B),
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "companyless@workhive.com"},
    ).status_code == 202

    payload = _accept_payload(delivery)
    assert client.post(
        "/api/v1/collaborations/invitations/activation-status",
        json={"token": payload["token"]},
    ).json() == {"mode": "sign_in"}
    response = client.post(
        "/api/v1/collaborations/invitations/activate-existing-account",
        headers=headers,
        json={
            **payload,
            "company_name": "Existing user company",
            "tax_id": "ACTIVATION-EXISTING",
            "address": "Existing Street 3",
            "phone": "600000003",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"status": "accepted"}


def test_new_recipient_can_decline_without_creating_an_account(client, monkeypatch):
    inviter_headers = _register_company(
        client,
        suffix="external-decline-inviter",
        email="external-decline-inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    delivery: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_decision_email",
        lambda **kwargs: True,
    )
    assert client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "external-decline@workhive.com"},
    ).status_code == 202

    declined = client.post(
        "/api/v1/collaborations/invitations/decline-external",
        json=_accept_payload(delivery),
    )
    assert declined.status_code == 204, declined.text
    assert client.get("/api/v1/collaborations/", headers=inviter_headers).json() == []


def test_company_invitation_requires_an_existing_recipient_to_be_an_admin(client, db, monkeypatch):
    inviter_headers = _register_company(
        client,
        suffix="existing-role-inviter",
        email="existing-role-inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    _register_company(
        client,
        suffix="existing-role-recipient",
        email="existing-role-recipient@workhive.com",
        secret=TEST_SECRET_B,
    )
    recipient = db.query(User).filter(User.email == "existing-role-recipient@workhive.com").one()
    recipient.role_id = 5
    db.commit()
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: True,
    )

    response = client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "existing-role-recipient@workhive.com"},
    )

    assert response.status_code == 409, response.text
    assert "administrator email" in response.json()["detail"]


def test_company_invitation_never_upgrades_an_internal_role_without_a_company(
    client, db, monkeypatch
):
    inviter_headers = _register_company(
        client,
        suffix="standalone-role-inviter",
        email="standalone-role-inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    internal_email = "standalone-accountant@workhive.com"
    assert client.post(
        "/api/v1/auth/register",
        json=with_credential(
            {
                "email": internal_email,
                "full_name": "Standalone accountant",
                "accept_terms": True,
                "accept_privacy": True,
                "policy_version": "2026-06-15",
            },
            TEST_SECRET_B,
        ),
    ).status_code == 201
    internal_user = db.query(User).filter(User.email == internal_email).one()
    internal_user.role_id = 5
    db.commit()
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: True,
    )

    response = client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": internal_email, "role_type": "service_provider"},
    )

    assert response.status_code == 409, response.text
    assert "administrator email" in response.json()["detail"]


def test_existing_internal_account_cannot_activate_a_legacy_company_invitation(
    client, db, monkeypatch
):
    inviter_headers = _register_company(
        client,
        suffix="legacy-role-inviter",
        email="legacy-role-inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    internal_email = "legacy-accountant@workhive.com"
    assert client.post(
        "/api/v1/auth/register",
        json=with_credential(
            {
                "email": internal_email,
                "full_name": "Legacy accountant",
                "accept_terms": True,
                "accept_privacy": True,
                "policy_version": "2026-06-15",
            },
            TEST_SECRET_B,
        ),
    ).status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        data=login_form(internal_email, TEST_SECRET_B),
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    delivery: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )
    assert client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": internal_email},
    ).status_code == 202
    internal_user = db.query(User).filter(User.email == internal_email).one()
    internal_user.role_id = 5
    db.commit()

    response = client.post(
        "/api/v1/collaborations/invitations/activate-existing-account",
        headers=headers,
        json={
            **_accept_payload(delivery),
            "company_name": "Should not be created",
            "tax_id": "LEGACY-ROLE-BLOCKED",
            "address": "Blocked Street 1",
            "phone": "600000005",
        },
    )

    assert response.status_code == 409, response.text
    assert "internal role" in response.json()["detail"]


def test_company_invitation_verifies_the_email_code_before_account_creation(client, monkeypatch):
    inviter_headers = _register_company(
        client,
        suffix="code-step-inviter",
        email="code-step-inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    delivery: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )
    assert client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "code-step-recipient@workhive.com"},
    ).status_code == 202

    verified = client.post(
        "/api/v1/collaborations/invitations/verify-code",
        json=_accept_payload(delivery),
    )

    assert verified.status_code == 200, verified.text
    assert verified.json() == {"email": "code-step-recipient@workhive.com"}


def test_reloading_invitation_status_does_not_block_code_verification(client, monkeypatch):
    """The public status check is safe to repeat and has its own limiter."""

    from app.core.config import settings

    monkeypatch.setattr(settings, "COMPANY_INVITATION_STATUS_RATE_LIMIT", 2, raising=False)
    inviter_headers = _register_company(
        client,
        suffix="status-limit-inviter",
        email="status-limit-inviter@workhive.com",
        secret=TEST_SECRET_A,
    )
    delivery: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_invitation_email",
        lambda **kwargs: delivery.update(kwargs) or True,
    )
    monkeypatch.setattr(
        "app.services.email_service.send_company_collaboration_decision_email",
        lambda **kwargs: True,
    )
    assert client.post(
        "/api/v1/collaborations/invitations",
        headers=inviter_headers,
        json={"email": "status-limit-recipient@workhive.com"},
    ).status_code == 202

    payload = _accept_payload(delivery)
    for _ in range(2):
        response = client.post(
            "/api/v1/collaborations/invitations/activation-status",
            json={"token": payload["token"]},
        )
        assert response.status_code == 200, response.text

    limited = client.post(
        "/api/v1/collaborations/invitations/activation-status",
        json={"token": payload["token"]},
    )
    assert limited.status_code == 429, limited.text

    activated = client.post(
        "/api/v1/collaborations/invitations/activate",
        json={
            **payload,
            "full_name": "Status limit admin",
            "company_name": "Status limit company",
            "tax_id": "STATUS-LIMIT-NEW",
            "address": "Status Street 1",
            "phone": "600000004",
            "password": TEST_SECRET_B,
            "accept_terms": True,
            "accept_privacy": True,
        },
    )
    assert activated.status_code == 201, activated.text
