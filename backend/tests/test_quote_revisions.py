from credentials import CREDENTIAL_FIELD, TEST_SECRET, login_form


def _authenticated_company(client, *, email: str, name: str, tax_id: str):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": name,
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    token = client.post(
        "/api/v1/auth/login",
        data=login_form(email, TEST_SECRET),
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    response = client.post(
        "/api/v1/companies/",
        json={
            "name": name,
            "tax_id": tax_id,
            "address": "Calle de las Revisiones 1",
            "phone": "+34600111222",
            "email": email,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return headers


def _quote_with_line(client, headers):
    response = client.post(
        "/api/v1/quotes/",
        json={
            "title": "Limpieza de salida",
            "notes": "Versión inicial",
            "items": [
                {
                    "description": "Limpieza completa",
                    "quantity": 2,
                    "unit_price": 75,
                }
            ],
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_quote_revisions_freeze_sent_content_and_link_acceptance_to_the_version(client):
    owner_headers = _authenticated_company(
        client,
        email="quote-revisions-owner@example.com",
        name="Presupuestos Owner",
        tax_id="B10000041",
    )
    outsider_headers = _authenticated_company(
        client,
        email="quote-revisions-outsider@example.com",
        name="Presupuestos Ajeno",
        tax_id="B10000042",
    )
    quote = _quote_with_line(client, owner_headers)

    sent = client.patch(
        f"/api/v1/quotes/{quote['id']}",
        json={"status": "sent"},
        headers=owner_headers,
    )
    assert sent.status_code == 200
    assert sent.json()["revision_number"] == 1

    revisions = client.get(
        f"/api/v1/quotes/{quote['id']}/revisions",
        headers=owner_headers,
    )
    assert revisions.status_code == 200
    first_revision = revisions.json()[0]
    assert first_revision["version"] == 1
    assert first_revision["snapshot"]["title"] == "Limpieza de salida"
    assert first_revision["snapshot"]["total_amount"] == 181.5
    assert first_revision["snapshot"]["items"] == [
        {
            "description": "Limpieza completa",
            "quantity": 2.0,
            "unit_price": 75.0,
            "subtotal": 150.0,
        }
    ]

    direct_edit = client.patch(
        f"/api/v1/quotes/{quote['id']}",
        json={"title": "Cambiar sin revisar"},
        headers=owner_headers,
    )
    assert direct_edit.status_code == 400
    assert "new revision" in direct_edit.json()["detail"]

    assert client.get(
        f"/api/v1/quotes/{quote['id']}/revisions",
        headers=outsider_headers,
    ).status_code == 404
    assert client.post(
        f"/api/v1/quotes/{quote['id']}/revisions",
        json={},
        headers=outsider_headers,
    ).status_code == 404

    revision_draft = client.post(
        f"/api/v1/quotes/{quote['id']}/revisions",
        json={},
        headers=owner_headers,
    )
    assert revision_draft.status_code == 200
    assert revision_draft.json()["status"] == "draft"
    assert revision_draft.json()["revision_number"] == 2

    updated = client.patch(
        f"/api/v1/quotes/{quote['id']}",
        json={"title": "Limpieza de salida con terraza"},
        headers=owner_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Limpieza de salida con terraza"

    assert client.patch(
        f"/api/v1/quotes/{quote['id']}",
        json={"status": "sent"},
        headers=owner_headers,
    ).status_code == 200

    history = client.get(
        f"/api/v1/quotes/{quote['id']}/revisions",
        headers=owner_headers,
    )
    assert history.status_code == 200
    second_revision, retained_first_revision = history.json()
    assert second_revision["version"] == 2
    assert second_revision["snapshot"]["title"] == "Limpieza de salida con terraza"
    assert retained_first_revision == first_revision

    accepted = client.post(
        f"/api/v1/quotes/{quote['id']}/accept",
        json={"register_client": False},
        headers=owner_headers,
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    assert accepted.json()["accepted_revision_id"] == second_revision["id"]

    accepted_history = client.get(
        f"/api/v1/quotes/{quote['id']}/revisions",
        headers=owner_headers,
    ).json()
    assert accepted_history[0]["id"] == second_revision["id"]
    assert accepted_history[0]["accepted_at"] is not None
    assert client.post(
        f"/api/v1/quotes/{quote['id']}/revisions",
        json={},
        headers=owner_headers,
    ).status_code == 400
