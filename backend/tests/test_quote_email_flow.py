from app.models.invoice_email_contact import InvoiceEmailContact
from credentials import CREDENTIAL_FIELD, TEST_SECRET, login_form


def _authenticated_company(client, *, email: str, company_name: str, tax_id: str):
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": company_name,
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    assert registration.status_code == 201, registration.text
    login = client.post("/api/v1/auth/login", data=login_form(email, TEST_SECRET))
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        json={
            "name": company_name,
            "tax_id": tax_id,
            "address": "Calle Principal 1",
            "phone": "+34600111222",
            "email": email,
        },
        headers=headers,
    )
    assert company.status_code == 201, company.text
    return headers, company.json()["id"]


def _quote(client, headers):
    created = client.post(
        "/api/v1/quotes/",
        json={
            "title": "Presupuesto de limpieza",
            "custom_recipient_info": "Cliente nuevo\ncliente@example.com",
            "items": [
                {
                    "description": "Limpieza completa",
                    "quantity": 1,
                    "unit_price": 120,
                }
            ],
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    return created.json()


def test_quote_email_sends_pdf_marks_sent_and_remembers_only_sender_contacts(
    client, db, monkeypatch
):
    sender_headers, sender_company_id = _authenticated_company(
        client,
        email="sender-quotes@example.com",
        company_name="Sender Quotes SL",
        tax_id="B10000011",
    )
    recipient_headers, recipient_company_id = _authenticated_company(
        client,
        email="recipient-quotes@example.com",
        company_name="Recipient Quotes SL",
        tax_id="B10000012",
    )
    quote = _quote(client, sender_headers)
    delivered = {}

    def capture_document_email(**kwargs):
        delivered.update(kwargs)
        delivered["pdf_bytes"] = kwargs["pdf_path"].read_bytes()
        return True

    monkeypatch.setattr(
        "app.services.email_service.send_invoice_email",
        capture_document_email,
    )

    sent = client.post(
        f"/api/v1/quotes/{quote['id']}/send-email",
        headers=sender_headers,
        json={
            "recipient_emails": ["external@example.com"],
            "copy_emails": ["copy@example.com"],
            "subject": "Tu presupuesto",
            "message": "Adjuntamos la propuesta.",
            "send_copy": True,
            "save_recipients": True,
        },
    )

    assert sent.status_code == 200, sent.text
    assert sent.json() == {
        "status": "sent",
        "recipient_email": "external@example.com",
    }
    assert delivered["recipient_email"] == ["external@example.com"]
    assert delivered["copy_emails"] == ["copy@example.com"]
    assert delivered["document_label"] == "Presupuesto"
    assert delivered["subject"] == "Tu presupuesto"
    assert delivered["sender_copy_email"] == "sender-quotes@example.com"
    assert delivered["pdf_bytes"].startswith(b"%PDF")
    assert not delivered["pdf_path"].exists()
    assert client.get(f"/api/v1/quotes/{quote['id']}", headers=sender_headers).json()["status"] == "sent"

    sender_contacts = client.get(
        "/api/v1/invoice-email-contacts/?q=external", headers=sender_headers
    )
    saved_contacts = sender_contacts.json()
    assert [contact["email"] for contact in saved_contacts] == [
        "external@example.com"
    ]
    assert saved_contacts[0]["name"] is None
    other_company_contacts = client.get(
        "/api/v1/invoice-email-contacts/?q=external", headers=recipient_headers
    )
    assert other_company_contacts.json() == []
    assert (
        db.query(InvoiceEmailContact)
        .filter(InvoiceEmailContact.company_id == sender_company_id)
        .count()
        == 1
    )
    assert (
        db.query(InvoiceEmailContact)
        .filter(InvoiceEmailContact.company_id == recipient_company_id)
        .count()
        == 0
    )


def test_quote_email_updates_client_email_only_when_explicitly_requested(
    client, monkeypatch
):
    headers, _ = _authenticated_company(
        client,
        email="quote-client-email-owner@example.com",
        company_name="Quote Client Email Owner SL",
        tax_id="B10000017",
    )
    billing_client = client.post(
        "/api/v1/clients/",
        headers=headers,
        json={
            "name": "Recipient Company",
            "client_type": "business",
            "address": "Calle Cliente 1",
            "city": "Girona",
            "postal_code": "17001",
            "country": "España",
        },
    )
    assert billing_client.status_code == 201, billing_client.text
    quote = client.post(
        "/api/v1/quotes/",
        headers=headers,
        json={
            "client_id": billing_client.json()["id"],
            "title": "Presupuesto con cliente",
            "items": [{"description": "Servicio", "quantity": 1, "unit_price": 120}],
        },
    )
    assert quote.status_code == 201, quote.text
    monkeypatch.setattr(
        "app.services.email_service.send_invoice_email",
        lambda **_: True,
    )

    sent = client.post(
        f"/api/v1/quotes/{quote.json()['id']}/send-email",
        headers=headers,
        json={
            "recipient_emails": ["confirmed-client-email@example.com"],
            "save_recipient_to_client_id": billing_client.json()["id"],
        },
    )

    assert sent.status_code == 200, sent.text
    updated_client = client.get(
        f"/api/v1/clients/{billing_client.json()['id']}", headers=headers
    )
    assert updated_client.json()["email"] == "confirmed-client-email@example.com"
    assert client.get(
        "/api/v1/invoice-email-contacts/?q=confirmed-client-email",
        headers=headers,
    ).json() == []


def test_saved_email_contacts_are_ordered_by_use_and_can_only_be_deleted_by_owner(
    client, db
):
    owner_headers, owner_company_id = _authenticated_company(
        client,
        email="saved-contact-owner@example.com",
        company_name="Saved Contact Owner SL",
        tax_id="B10000015",
    )
    outsider_headers, outsider_company_id = _authenticated_company(
        client,
        email="saved-contact-outsider@example.com",
        company_name="Saved Contact Outsider SL",
        tax_id="B10000016",
    )
    low_use = InvoiceEmailContact(
        company_id=owner_company_id,
        email="low-use@example.com",
        use_count=1,
    )
    high_use = InvoiceEmailContact(
        company_id=owner_company_id,
        email="high-use@example.com",
        use_count=8,
    )
    outsider_contact = InvoiceEmailContact(
        company_id=outsider_company_id,
        email="other-company@example.com",
        use_count=5,
    )
    db.add_all([low_use, high_use, outsider_contact])
    db.commit()
    db.refresh(low_use)
    db.refresh(high_use)
    db.refresh(outsider_contact)

    listed = client.get("/api/v1/invoice-email-contacts/", headers=owner_headers)
    assert listed.status_code == 200, listed.text
    assert [contact["email"] for contact in listed.json()] == [
        "high-use@example.com",
        "low-use@example.com",
    ]

    deleted = client.delete(
        f"/api/v1/invoice-email-contacts/{low_use.id}",
        headers=owner_headers,
    )
    assert deleted.status_code == 204, deleted.text
    assert db.get(InvoiceEmailContact, low_use.id) is None

    cross_tenant_delete = client.delete(
        f"/api/v1/invoice-email-contacts/{outsider_contact.id}",
        headers=owner_headers,
    )
    assert cross_tenant_delete.status_code == 404, cross_tenant_delete.text
    assert db.get(InvoiceEmailContact, outsider_contact.id) is not None

    assert client.get(
        "/api/v1/invoice-email-contacts/", headers=outsider_headers
    ).json()[0]["email"] == "other-company@example.com"


def test_quote_email_is_tenant_scoped_and_does_not_change_status_when_delivery_fails(
    client, monkeypatch
):
    owner_headers, _ = _authenticated_company(
        client,
        email="owner-quote-email@example.com",
        company_name="Owner Quote Email SL",
        tax_id="B10000013",
    )
    outsider_headers, _ = _authenticated_company(
        client,
        email="outsider-quote-email@example.com",
        company_name="Outsider Quote Email SL",
        tax_id="B10000014",
    )
    quote = _quote(client, owner_headers)

    assert client.post(
        f"/api/v1/quotes/{quote['id']}/send-email",
        headers=outsider_headers,
        json={"recipient_emails": ["external@example.com"]},
    ).status_code == 404

    monkeypatch.setattr(
        "app.services.email_service.send_invoice_email",
        lambda **_: False,
    )
    failed = client.post(
        f"/api/v1/quotes/{quote['id']}/send-email",
        headers=owner_headers,
        json={"recipient_emails": ["external@example.com"]},
    )

    assert failed.status_code == 503
    assert client.get(f"/api/v1/quotes/{quote['id']}", headers=owner_headers).json()["status"] == "draft"


def test_quote_email_requires_an_explicit_or_same_company_client_recipient(client):
    headers, _ = _authenticated_company(
        client,
        email="missing-recipient@example.com",
        company_name="Missing Recipient SL",
        tax_id="B10000015",
    )
    quote = _quote(client, headers)

    response = client.post(
        f"/api/v1/quotes/{quote['id']}/send-email",
        headers=headers,
        json={},
    )

    assert response.status_code == 422
    assert "does not have an email" in response.json()["detail"]
