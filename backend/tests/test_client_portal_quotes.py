from datetime import datetime, timedelta, timezone
import pytest
from app.models.audit_log import AuditLog
from app.models.company_membership import CompanyMembership
from app.models.external_access_grant import ExternalAccessGrant
from app.models.quote import Quote
from app.models.service_contract import ServiceContract
from app.schemas.quote import QuoteCreate, QuoteUpdate, QuoteRevisionCreate
from app.schemas.quote_item import QuoteItemCreate
from app.services import quote_service, quote_revision_service, client_portal_quote_service, email_service
from test_client_portal_api import _company, _internal_user, _client, _portal_user, _grant


def fixture(client, db, suffix="approval", *, sent=True, until=None):
    company = _company(db, suffix)
    admin, _ = _internal_user(db, company=company, suffix=suffix)
    customer = _client(db, company=company, suffix=suffix)
    user, headers = _portal_user(db, email=f"customer-{suffix}@example.com", suffix=suffix)
    grant = _grant(db, company=company, customer=customer, user=user, admin=admin)
    db.commit()
    quote = quote_service.create_quote(db, company.id, QuoteCreate(client_id=customer.id, title="Servicio a aprobar",
        valid_until=until or datetime.now(timezone.utc) + timedelta(days=10), notes="INTERNAL_PRIVATE_NOTE",
        custom_issuer_info="INTERNAL_ISSUER_TEXT", custom_recipient_info="INTERNAL_RECIPIENT_TEXT",
        terms="Servicios y precio acordados", items=[QuoteItemCreate(description="Limpieza por espacios", quantity=2, unit_price=100)]))
    if sent:
        quote = quote_service.update_quote(db, company.id, quote.id, QuoteUpdate(status="sent"), actor_user_id=admin.id)
    return company, admin, customer, user, headers, grant, quote


def accept_url(grant, quote):
    return f"/api/v1/client-portal/workspaces/{grant.id}/quotes/{quote.id}/accept"


def test_customer_accepts_only_the_published_revision_without_finance_access(client, db, monkeypatch):
    company, admin, customer, user, headers, grant, quote = fixture(client, db)
    monkeypatch.setattr(email_service, "send_invoice_email", lambda **kwargs: pytest.fail("Acceptance must not send email"))
    result = client.post(accept_url(grant, quote), headers=headers, json={"expected_revision": 1, "confirmed": True})
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "accepted" and result.json()["revision_number"] == 1
    assert "notes" not in result.json()
    db.expire_all(); quote = db.get(Quote, quote.id)
    assert quote.accepted_revision is not None and quote.accepted_revision.accepted_at is not None
    contract = db.query(ServiceContract).filter_by(company_id=company.id, source_quote_id=quote.id).one()
    assert contract.status == "draft" and contract.client_id == customer.id
    event = db.query(AuditLog).filter_by(action="quote.client_accepted", entity_id=str(quote.id)).one()
    assert event.actor_user_id == user.id and event.details["revision_id"] == quote.accepted_revision_id
    assert event.details["confirmed"] is True and event.details["grant_id"] == grant.id
    assert user.company_id is None and user.role.name == "client_portal"
    assert db.query(CompanyMembership).filter_by(user_id=user.id).count() == 0
    assert db.query(ExternalAccessGrant).filter_by(user_id=user.id).count() == 0
    assert client.get("/api/v1/quotes/", headers=headers).status_code in {400, 403}
    assert client.post(accept_url(grant, quote), headers=headers, json={"expected_revision": 1, "confirmed": True}).status_code == 409
    assert db.query(ServiceContract).filter_by(source_quote_id=quote.id).count() == 1


def test_customer_cannot_accept_quotes_of_another_client_or_foreign_grant(client, db):
    _, _, _, _, headers, grant, quote = fixture(client, db, "own")
    _, _, _, _, foreign_headers, foreign_grant, foreign_quote = fixture(client, db, "foreign")
    assert client.post(accept_url(grant, foreign_quote), headers=headers, json={"expected_revision": 1, "confirmed": True}).status_code == 404
    assert client.post(accept_url(foreign_grant, foreign_quote), headers=headers, json={"expected_revision": 1, "confirmed": True}).status_code == 403
    assert client.post(accept_url(grant, quote), headers=foreign_headers, json={"expected_revision": 1, "confirmed": True}).status_code == 403
    assert db.get(Quote, quote.id).status == "sent" and db.get(Quote, foreign_quote.id).status == "sent"
    assert db.query(ServiceContract).count() == 0


def test_customer_approval_rejects_stale_revision_and_unpublished_draft(client, db):
    company, admin, _, _, headers, grant, quote = fixture(client, db, "stale")
    quote_revision_service.create_quote_revision(db, company.id, quote.id, QuoteRevisionCreate(), actor_user_id=admin.id)
    assert client.post(accept_url(grant, quote), headers=headers, json={"expected_revision": 1, "confirmed": True}).status_code == 404
    quote_service.update_quote(db, company.id, quote.id, QuoteUpdate(title="Nueva propuesta", status="sent"), actor_user_id=admin.id)
    response = client.post(accept_url(grant, quote), headers=headers, json={"expected_revision": 1, "confirmed": True})
    assert response.status_code == 409 and "ha cambiado" in response.text
    assert db.get(Quote, quote.id).status == "sent" and db.query(ServiceContract).count() == 0


@pytest.mark.parametrize("state", ["expired_grant", "revoked_grant", "expired_quote", "snapshot_drift"])
def test_customer_approval_rechecks_current_access_validity_and_content(client, db, state):
    _, _, _, _, headers, grant, quote = fixture(client, db, state,
        until=datetime.now(timezone.utc) - timedelta(days=1) if state == "expired_quote" else None)
    if state == "expired_grant":
        grant.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    elif state == "revoked_grant":
        grant.status = "revoked"
    elif state == "snapshot_drift":
        quote.total_amount += 1
    db.commit()
    response = client.post(accept_url(grant, quote), headers=headers, json={"expected_revision": 1, "confirmed": True})
    assert response.status_code == (403 if state.endswith("grant") else 409), response.text
    assert db.get(Quote, quote.id).status == "sent" and db.query(ServiceContract).count() == 0
    assert db.query(AuditLog).filter_by(action="quote.client_accepted").count() == 0


def test_customer_approval_requires_explicit_confirmation_and_forbids_admin_fields(client, db):
    _, _, _, _, headers, grant, quote = fixture(client, db, "confirmation")
    for payload in ({"expected_revision": 1}, {"expected_revision": 1, "confirmed": False},
        {"expected_revision": 1, "confirmed": True, "register_client": True}, {"expected_revision": 1, "confirmed": "true"}):
        assert client.post(accept_url(grant, quote), headers=headers, json=payload).status_code == 422
    assert db.get(Quote, quote.id).status == "sent" and db.query(ServiceContract).count() == 0


def test_portal_quote_pdf_is_scoped_redacted_and_temporary_file_is_removed(client, db, monkeypatch):
    _, _, _, _, headers, grant, quote = fixture(client, db, "pdf")
    _, _, _, _, _, _, foreign_quote = fixture(client, db, "pdf-foreign")
    original = client_portal_quote_service.generate_quote_email_pdf
    paths = []
    def generate(public):
        assert public.notes is None and public.custom_issuer_info is None and public.custom_recipient_info is None
        path = original(public); paths.append(path); return path
    monkeypatch.setattr(client_portal_quote_service, "generate_quote_email_pdf", generate)
    response = client.get(f"/api/v1/client-portal/workspaces/{grant.id}/quotes/{quote.id}/pdf", headers=headers)
    assert response.status_code == 200, response.text
    assert response.content.startswith(b"%PDF") and response.headers["cache-control"] == "private, no-store"
    assert len(paths) == 1 and not paths[0].exists()
    assert db.get(Quote, quote.id).notes == "INTERNAL_PRIVATE_NOTE"
    assert client.get(f"/api/v1/client-portal/workspaces/{grant.id}/quotes/{foreign_quote.id}/pdf", headers=headers).status_code == 404
    assert len(paths) == 1
