from datetime import datetime, timezone

from credentials import TEST_SECRET_B, login_form

from app.core.security import create_access_token, get_password_hash
from app.models.client import Client
from app.models.client_portal_grant import ClientPortalGrant
from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.quote import Quote
from app.models.quote_item import QuoteItem
from app.models.role import Role
from app.models.user import User


def _company(db, suffix: str) -> Company:
    company = Company(
        name=f"Provider {suffix}",
        tax_id=f"CLIENT-PORTAL-{suffix}",
        address="Calle Provider 1",
        phone="600000000",
        email=f"provider-{suffix}@example.com",
        subscription_plan="top",
        subscription_status="active",
    )
    db.add(company)
    db.flush()
    return company


def _internal_user(db, *, company: Company, suffix: str) -> tuple[User, dict[str, str]]:
    role = db.query(Role).filter(Role.name == "admin").one()
    user = User(
        email=f"admin-{suffix}@example.com",
        hashed_password=get_password_hash(TEST_SECRET_B),
        full_name=f"Admin {suffix}",
        company_id=company.id,
        role_id=role.id,
    )
    db.add(user)
    db.flush()
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return user, {"Authorization": f"Bearer {token}"}


def _client(db, *, company: Company, suffix: str) -> Client:
    customer = Client(
        name=f"Customer {suffix}",
        address="Calle Cliente 2",
        city="Madrid",
        postal_code="28001",
        country="España",
        company_id=company.id,
    )
    db.add(customer)
    db.flush()
    return customer


def _portal_user(db, *, email: str, suffix: str) -> tuple[User, dict[str, str]]:
    role = db.query(Role).filter(Role.name == "client_portal").one()
    user = User(
        email=email,
        hashed_password=get_password_hash(TEST_SECRET_B),
        full_name=f"Portal {suffix}",
        company_id=None,
        role_id=role.id,
    )
    db.add(user)
    db.flush()
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return user, {"Authorization": f"Bearer {token}"}


def _grant(db, *, company: Company, customer: Client, user: User, admin: User) -> ClientPortalGrant:
    grant = ClientPortalGrant(
        company_id=company.id,
        client_id=customer.id,
        user_id=user.id,
        granted_by_user_id=admin.id,
        status="active",
    )
    db.add(grant)
    db.flush()
    return grant


def test_client_portal_is_document_scoped_and_cannot_cross_workspaces(client, db):
    company = _company(db, "A")
    admin, admin_headers = _internal_user(db, company=company, suffix="A")
    customer = _client(db, company=company, suffix="A")
    other_customer = _client(db, company=company, suffix="OTHER")
    user, headers = _portal_user(db, email="customer-portal@example.com", suffix="A")
    other_user, other_headers = _portal_user(db, email="other-portal@example.com", suffix="OTHER")
    grant = _grant(db, company=company, customer=customer, user=user, admin=admin)
    other_grant = _grant(db, company=company, customer=other_customer, user=other_user, admin=admin)

    own_invoice = Invoice(
        company_id=company.id,
        client_id=customer.id,
        invoice_number="INV-OWN",
        issue_date=datetime.now(timezone.utc),
        status="issued",
        base_amount=100,
        tax_amount=21,
        total_amount=121,
        notes="private finance note",
    )
    other_invoice = Invoice(
        company_id=company.id,
        client_id=other_customer.id,
        invoice_number="INV-OTHER",
        issue_date=datetime.now(timezone.utc),
        status="issued",
        base_amount=200,
        tax_amount=42,
        total_amount=242,
    )
    own_quote = Quote(
        company_id=company.id,
        client_id=customer.id,
        quote_number="QUO-OWN",
        title="Servicio mensual",
        status="sent",
        base_amount=100,
        tax_amount=21,
        total_amount=121,
        notes="private sales note",
        terms="Pago a 30 días",
    )
    draft_quote = Quote(
        company_id=company.id,
        client_id=customer.id,
        quote_number="QUO-DRAFT",
        title="No mostrar",
        status="draft",
    )
    db.add_all([own_invoice, other_invoice, own_quote, draft_quote])
    db.flush()
    db.add_all([
        InvoiceItem(invoice_id=own_invoice.id, description="Limpieza", quantity=1, unit_price=100, tax_rate=0.21, subtotal=100, total=121),
        QuoteItem(quote_id=own_quote.id, description="Limpieza", quantity=1, unit_price=100, subtotal=100),
    ])
    db.commit()

    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["role"]["name"] == "client_portal"
    assert me.json()["company_id"] is None

    workspaces = client.get("/api/v1/client-portal/workspaces", headers=headers)
    assert workspaces.status_code == 200, workspaces.text
    assert workspaces.json() == [{
        "id": grant.id,
        "company_name": company.name,
        "client_name": customer.name,
        "status": "active",
        "expires_at": None,
    }]

    overview = client.get(f"/api/v1/client-portal/workspaces/{grant.id}/overview", headers=headers)
    assert overview.status_code == 200, overview.text
    body = overview.json()
    assert [invoice["invoice_number"] for invoice in body["invoices"]] == ["INV-OWN"]
    assert [quote["quote_number"] for quote in body["quotes"]] == ["QUO-OWN"]
    assert body["invoices"][0]["lines"][0]["description"] == "Limpieza"
    assert "notes" not in body["invoices"][0]
    assert "notes" not in body["quotes"][0]
    assert body["quotes"][0]["terms"] == "Pago a 30 días"

    assert client.get(
        f"/api/v1/client-portal/workspaces/{other_grant.id}/overview",
        headers=headers,
    ).status_code == 403
    assert client.get(
        f"/api/v1/client-portal/workspaces/{grant.id}/invoices/{other_invoice.id}/pdf",
        headers=headers,
    ).status_code == 404
    # Generic financial routes demand an internal company context; the portal
    # session has none and therefore cannot fall through into tenant finance.
    assert client.get("/api/v1/invoices/", headers=headers).status_code == 400
    assert client.get("/api/v1/client-portal/workspaces", headers=other_headers).status_code == 200
    assert client.get(
        f"/api/v1/client-portal/clients/{customer.id}/grants",
        headers=headers,
    ).status_code == 403

    other_company = _company(db, "OUTSIDE")
    other_customer = _client(db, company=other_company, suffix="OUTSIDE")
    _, other_admin_headers = _internal_user(db, company=other_company, suffix="OUTSIDE")
    assert client.get(
        f"/api/v1/client-portal/clients/{other_customer.id}/grants",
        headers=admin_headers,
    ).status_code == 404
    assert client.get(
        f"/api/v1/client-portal/clients/{other_customer.id}/grants",
        headers=other_admin_headers,
    ).status_code == 200


def test_client_portal_invitation_creates_a_nonmember_and_accumulates_company_workspaces(client, db, monkeypatch):
    company_a = _company(db, "INVITE-A")
    admin_a, admin_headers_a = _internal_user(db, company=company_a, suffix="INVITE-A")
    customer_a = _client(db, company=company_a, suffix="INVITE-A")
    delivery_a: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_client_portal_invitation_email",
        lambda **kwargs: delivery_a.update(kwargs) or True,
    )

    created = client.post(
        f"/api/v1/client-portal/clients/{customer_a.id}/invitations",
        headers=admin_headers_a,
        json={"email": "same-person@example.com"},
    )
    assert created.status_code == 201, created.text
    assert "accept-client-portal-invitation#token=" in str(delivery_a["invitation_url"])
    token_a = str(delivery_a["invitation_url"]).split("#token=", 1)[1]
    accepted_a = client.post(
        "/api/v1/client-portal/invitations/accept",
        json={
            "token": token_a,
            "verification_code": delivery_a["verification_code"],
            "full_name": "Same Person",
            "password": TEST_SECRET_B,
            "accept_terms": True,
            "accept_privacy": True,
        },
    )
    assert accepted_a.status_code == 200, accepted_a.text
    portal_user = db.query(User).filter(User.email == "same-person@example.com").one()
    assert portal_user.company_id is None
    assert portal_user.role.name == "client_portal"
    assert db.query(CompanyMembership).filter(CompanyMembership.user_id == portal_user.id).count() == 0

    company_b = _company(db, "INVITE-B")
    _, admin_headers_b = _internal_user(db, company=company_b, suffix="INVITE-B")
    customer_b = _client(db, company=company_b, suffix="INVITE-B")
    delivery_b: dict[str, object] = {}
    monkeypatch.setattr(
        "app.services.email_service.send_client_portal_invitation_email",
        lambda **kwargs: delivery_b.update(kwargs) or True,
    )
    created_b = client.post(
        f"/api/v1/client-portal/clients/{customer_b.id}/invitations",
        headers=admin_headers_b,
        json={"email": "same-person@example.com"},
    )
    assert created_b.status_code == 201, created_b.text
    token_b = str(delivery_b["invitation_url"]).split("#token=", 1)[1]
    accepted_b = client.post(
        "/api/v1/client-portal/invitations/accept",
        json={
            "token": token_b,
            "verification_code": delivery_b["verification_code"],
            "full_name": "Ignored for existing account",
            "accept_terms": True,
            "accept_privacy": True,
        },
    )
    assert accepted_b.status_code == 200, accepted_b.text

    login = client.post("/api/v1/auth/login", data=login_form("same-person@example.com", TEST_SECRET_B))
    assert login.status_code == 200, login.text
    portal_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    workspaces = client.get("/api/v1/client-portal/workspaces", headers=portal_headers)
    assert workspaces.status_code == 200, workspaces.text
    assert {(item["company_name"], item["client_name"]) for item in workspaces.json()} == {
        (company_a.name, customer_a.name),
        (company_b.name, customer_b.name),
    }

    grants = client.get(
        f"/api/v1/client-portal/clients/{customer_a.id}/grants",
        headers=admin_headers_a,
    )
    assert grants.status_code == 200, grants.text
    revoked = client.delete(
        f"/api/v1/client-portal/clients/{customer_a.id}/grants/{grants.json()[0]['id']}",
        headers=admin_headers_a,
    )
    assert revoked.status_code == 200, revoked.text
    after_revocation = client.get("/api/v1/client-portal/workspaces", headers=portal_headers)
    assert {(item["company_name"], item["client_name"]) for item in after_revocation.json()} == {
        (company_b.name, customer_b.name),
    }
