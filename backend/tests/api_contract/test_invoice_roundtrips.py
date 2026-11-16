from datetime import datetime, timezone
from contextlib import contextmanager

from app.integrations.aeat.client import AeatSubmissionResult


def test_draft_items_issue_documents_and_rectification_over_http(client, api_workspace):
    qa = api_workspace
    headers = qa.headers["admin"]
    root = "/api/v1/invoices"
    data = {
        "client_id": qa.client.id,
        "issue_date": datetime.now(timezone.utc).isoformat(),
    }
    item = {
        "description": "QA service",
        "quantity": 1,
        "unit_price": 100,
        "tax_rate": 0.21,
    }
    for suffix in ["completed-jobs", "fiscal/readiness"]:
        response = client.get(f"{root}/{suffix}", headers=headers)
        assert response.status_code == 200, response.text
    assert (
        client.post(
            root + "/drafts", headers=headers, json={**data, "items": []}
        ).status_code
        == 422
    )
    assert (
        client.post(
            root + "/drafts",
            headers=qa.headers["worker"],
            json={**data, "items": [item]},
        ).status_code
        == 403
    )
    created = client.post(root + "/", headers=headers, json=data)
    assert created.status_code == 201, created.text
    editable = f"{root}/{created.json()['id']}"
    added = client.post(editable + "/items", headers=headers, json=item)
    assert added.status_code == 201, added.text
    item_path = f"{editable}/items/{added.json()['id']}"
    changed = client.patch(item_path, headers=headers, json={"quantity": 2})
    assert changed.status_code == 200 and changed.json()["quantity"] == 2, changed.text
    assert client.delete(item_path, headers=headers).status_code == 204
    draft = client.post(
        root + "/drafts", headers=headers, json={**data, "items": [item]}
    )
    assert draft.status_code == 201, draft.text
    path = f"{root}/{draft.json()['id']}"
    assert (
        client.patch(path, headers=headers, json={"notes": "QA transport"}).status_code
        == 200
    )
    assert client.get(path, headers=qa.headers["outsider"]).status_code in {403, 404}
    issued = client.post(path + "/issue", headers=headers)
    assert issued.status_code == 200 and issued.json()["status"] == "issued", (
        issued.text
    )
    assert issued.json()["total_amount"] == 121
    for suffix in ["pdf", "fiscal-record", "fiscal-record/xml", "facturae/readiness"]:
        response = client.get(f"{path}/{suffix}", headers=headers)
        assert response.status_code == 200, response.text
        assert client.get(
            f"{path}/{suffix}", headers=qa.headers["outsider"]
        ).status_code in {403, 404}
        if suffix == "pdf":
            assert response.content.startswith(b"%PDF-")
    generated = client.post(path + "/facturae", headers=headers, json={"sign": False})
    assert generated.status_code == 200, generated.text
    document = client.get(path + "/facturae", headers=headers)
    assert document.status_code == 200 and b"Facturae" in document.content, (
        document.text
    )
    rectified = client.post(
        path + "/rectify",
        headers=headers,
        json={"reason": "QA incorrect amount", "issue_date": data["issue_date"]},
    )
    assert rectified.status_code == 201 and rectified.json()["total_amount"] == -121, (
        rectified.text
    )
    assert client.get(path, headers=headers).json()["status"] == "rectified"


def test_email_contacts_are_tenant_scoped(client, api_workspace):
    qa = api_workspace
    root = "/api/v1/invoice-email-contacts/"
    created = client.post(
        root,
        headers=qa.headers["admin"],
        json={"email": "qa@example.com", "name": "QA recipient"},
    )
    assert created.status_code == 201, created.text
    assert client.get(root, headers=qa.headers["outsider"]).json() == []
    assert client.delete(
        f"{root}{created.json()['id']}", headers=qa.headers["outsider"]
    ).status_code in {403, 404}
    assert (
        client.get(root, headers=qa.headers["admin"]).json()[0]["email"]
        == "qa@example.com"
    )


def test_fiscal_submission_and_cancellation_use_the_company_record(
    client, api_workspace, monkeypatch
):
    qa = api_workspace
    calls = []

    @contextmanager
    def credentials(_db, company_id):
        assert company_id == qa.company.id
        yield "qa-certificate-not-read", "qa-certificate-not-used", "preproduction"

    def submit(xml, **kwargs):
        calls.append(xml)
        return AeatSubmissionResult(
            status="accepted",
            csv="QA-SIMULATED-CSV",
            error_code=None,
            error_message=None,
            response_xml="<QA/>",
            response_data={"simulation": True},
        )

    monkeypatch.setattr(
        "app.services.company_fiscal_settings_service.submission_credentials",
        credentials,
    )
    monkeypatch.setattr("app.services.fiscal_submission_service.submit_record", submit)
    created = client.post(
        "/api/v1/invoices/drafts",
        headers=qa.headers["admin"],
        json={
            "client_id": qa.client.id,
            "issue_date": datetime.now(timezone.utc).isoformat(),
            "items": [{"description": "QA fiscal transport", "unit_price": 10}],
        },
    )
    assert created.status_code == 201, created.text
    path = f"/api/v1/invoices/{created.json()['id']}"
    assert client.post(path + "/issue", headers=qa.headers["admin"]).status_code == 200
    assert (
        client.post(
            path + "/fiscal-record/submit", headers=qa.headers["outsider"]
        ).status_code
        == 404
    )
    assert calls == []
    submitted = client.post(path + "/fiscal-record/submit", headers=qa.headers["admin"])
    assert (
        submitted.status_code == 200
        and submitted.json()["submission_status"] == "accepted"
    ), submitted.text
    assert len(calls) == 1
    assert (
        client.post(
            path + "/fiscal-record/submit", headers=qa.headers["admin"]
        ).status_code
        == 200
    )
    assert len(calls) == 1
    payload = {
        "reason": "QA invoice issued without any real operation",
        "confirm_no_real_operation": True,
    }
    assert (
        client.post(
            path + "/fiscal-record/cancel", headers=qa.headers["outsider"], json=payload
        ).status_code
        == 404
    )
    cancelled = client.post(
        path + "/fiscal-record/cancel", headers=qa.headers["admin"], json=payload
    )
    assert (
        cancelled.status_code == 201 and cancelled.json()["record_type"] == "anulacion"
    ), cancelled.text
