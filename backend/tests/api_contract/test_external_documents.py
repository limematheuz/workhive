from datetime import datetime, timezone

from tests.test_client_portal_api import _grant, _portal_user
from tests.test_public_api_access import _work_order


def test_public_work_order_detail_has_the_same_scope_as_its_list(
    client, db, api_workspace
):
    qa = api_workspace
    own = _work_order(db, company=qa.company, suffix="contract-own")
    foreign = _work_order(db, company=qa.other, suffix="contract-other")
    db.commit()
    key = client.post(
        "/api/v1/api-access-keys/",
        headers=qa.headers["admin"],
        json={"name": "QA read key", "scopes": ["work_orders.read"]},
    )
    assert key.status_code == 201, key.text
    headers = {"X-WorkHive-API-Key": key.json()["api_key"]}
    detail = client.get(f"/api/v1/public/work-orders/{own.id}", headers=headers)
    assert detail.status_code == 200 and detail.json()["id"] == own.id, detail.text
    assert "description" not in detail.json() and "company_id" not in detail.json()
    assert (
        client.get(
            f"/api/v1/public/work-orders/{foreign.id}", headers=headers
        ).status_code
        == 404
    )


def test_client_invitation_list_and_revocation_are_company_scoped(
    client, api_workspace, monkeypatch
):
    qa = api_workspace
    monkeypatch.setattr(
        "app.services.email_service.send_client_portal_invitation_email",
        lambda **kwargs: True,
    )
    path = f"/api/v1/client-portal/clients/{qa.client.id}/invitations"
    invitation = client.post(
        path, headers=qa.headers["admin"], json={"email": "qa-portal@example.com"}
    )
    assert invitation.status_code == 201, invitation.text
    invitation_id = invitation.json()["id"]
    listed = client.get(path, headers=qa.headers["admin"])
    assert listed.status_code == 200 and listed.json()[0]["id"] == invitation_id, (
        listed.text
    )
    assert (
        client.delete(
            f"{path}/{invitation_id}", headers=qa.headers["outsider"]
        ).status_code
        == 404
    )
    revoked = client.delete(f"{path}/{invitation_id}", headers=qa.headers["admin"])
    assert revoked.status_code == 200 and revoked.json()["status"] == "revoked", (
        revoked.text
    )


def test_client_portal_downloads_the_issued_invoice_document(client, db, api_workspace):
    qa = api_workspace
    portal_user, portal_headers = _portal_user(
        db, email="qa-document-portal@example.com", suffix="contract-document"
    )
    grant = _grant(
        db, company=qa.company, customer=qa.client, user=portal_user, admin=qa.admin
    )
    db.commit()
    draft = client.post(
        "/api/v1/invoices/drafts",
        headers=qa.headers["admin"],
        json={
            "client_id": qa.client.id,
            "issue_date": datetime.now(timezone.utc).isoformat(),
            "items": [{"description": "QA invoice", "unit_price": 10}],
        },
    )
    assert draft.status_code == 201, draft.text
    invoice_id = draft.json()["id"]
    assert (
        client.post(
            f"/api/v1/invoices/{invoice_id}/issue", headers=qa.headers["admin"]
        ).status_code
        == 200
    )
    path = f"/api/v1/client-portal/workspaces/{grant.id}/invoices/{invoice_id}/pdf"
    document = client.get(path, headers=portal_headers)
    assert document.status_code == 200 and document.content.startswith(b"%PDF-"), (
        document.text
    )
    assert client.get(path, headers=qa.headers["outsider"]).status_code in {403, 404}
