from datetime import datetime, timezone

from app.models.company_collaboration import CompanyCollaboration


def test_client_email_and_complaint_detail_keep_tenant_boundaries(
    client, api_workspace, monkeypatch
):
    qa = api_workspace
    delivered = []
    monkeypatch.setattr(
        "app.services.email_service.send_client_email",
        lambda **kwargs: delivered.append(kwargs) or True,
    )
    email = client.post(
        f"/api/v1/clients/{qa.client.id}/send-email",
        headers=qa.headers["admin"],
        json={
            "recipient_emails": ["qa-recipient@example.com"],
            "subject": "QA subject",
            "message": "QA message",
        },
    )
    assert email.status_code == 200 and len(delivered) == 1, email.text
    complaint = client.post(
        "/api/v1/quality/complaints/",
        headers=qa.headers["admin"],
        json={
            "location_id": qa.location.id,
            "title": "QA complaint",
            "description": "QA issue to investigate",
        },
    )
    assert complaint.status_code == 201, complaint.text
    path = f"/api/v1/quality/complaints/{complaint.json()['id']}"
    assert client.get(path, headers=qa.headers["admin"]).status_code == 200
    assert client.get(path, headers=qa.headers["outsider"]).status_code == 404


def test_requested_task_can_be_rejected_and_stays_rejected(client, db, api_workspace):
    qa = api_workspace
    qa.task.status = "requested"
    db.commit()
    path = f"/api/v1/task-items/{qa.task.id}/reject"
    assert client.post(path, headers=qa.headers["outsider"]).status_code in {403, 404}
    rejected = client.post(path, headers=qa.headers["admin"])
    assert rejected.status_code == 200 and rejected.json()["status"] == "rejected", (
        rejected.text
    )
    assert client.post(path, headers=qa.headers["admin"]).status_code == 400


def test_expense_and_collaboration_removal_are_authorized(client, db, api_workspace):
    qa = api_workspace
    expense = client.post(
        "/api/v1/expenses/",
        headers=qa.headers["admin"],
        json={
            "expense_date": datetime.now(timezone.utc).isoformat(),
            "category": "other",
            "description": "QA expense",
            "base_amount": 10,
        },
    )
    assert expense.status_code == 201, expense.text
    path = f"/api/v1/expenses/{expense.json()['id']}"
    assert client.delete(path, headers=qa.headers["outsider"]).status_code in {403, 404}
    removed = client.delete(path, headers=qa.headers["admin"])
    assert removed.status_code == 204, removed.text
    link = CompanyCollaboration(
        initiator_company_id=qa.company.id,
        partner_company_id=qa.other.id,
        status="accepted",
    )
    db.add(link)
    db.commit()
    partners = client.get(
        "/api/v1/collaborations/service-providers", headers=qa.headers["admin"]
    )
    assert partners.status_code == 200, partners.text
    assert any(row["id"] == qa.other.id for row in partners.json())
    assert (
        client.delete(
            f"/api/v1/collaborations/{link.id}", headers=qa.headers["worker"]
        ).status_code
        == 403
    )
    removed = client.delete(
        f"/api/v1/collaborations/{link.id}", headers=qa.headers["admin"]
    )
    assert removed.status_code == 204, removed.text


def test_unassigned_organization_structures_can_be_changed_and_archived(
    client, api_workspace
):
    headers = api_workspace.headers["admin"]
    root = "/api/v1/organization"
    department = client.post(
        root + "/departments", headers=headers, json={"name": "QA department"}
    )
    assert department.status_code == 201, department.text
    path = f"{root}/departments/{department.json()['id']}"
    assert (
        client.patch(path, headers=headers, json={"name": "QA renamed"}).status_code
        == 200
    )
    assert client.delete(path, headers=headers).status_code == 204
    team = client.post(root + "/teams", headers=headers, json={"name": "QA team"})
    assert team.status_code == 201, team.text
    assert (
        client.delete(f"{root}/teams/{team.json()['id']}", headers=headers).status_code
        == 204
    )
    profile = client.post(
        root + "/permission-profiles",
        headers=headers,
        json={"name": "QA unassigned profile", "permission_codes": ["locations.read"]},
    )
    assert profile.status_code == 201, profile.text
    assert (
        client.delete(
            f"{root}/permission-profiles/{profile.json()['id']}", headers=headers
        ).status_code
        == 204
    )


def test_quote_items_are_readable_only_inside_their_company(client, api_workspace):
    qa = api_workspace
    quote = client.post(
        "/api/v1/quotes/",
        headers=qa.headers["admin"],
        json={
            "client_id": qa.client.id,
            "title": "QA items transport",
            "items": [{"description": "QA item", "quantity": 1, "unit_price": 10}],
        },
    )
    assert quote.status_code == 201, quote.text
    path = f"/api/v1/quotes/{quote.json()['id']}/items"
    items = client.get(path, headers=qa.headers["admin"])
    assert items.status_code == 200 and items.json()[0]["description"] == "QA item", (
        items.text
    )
    assert client.get(path, headers=qa.headers["outsider"]).status_code == 404
