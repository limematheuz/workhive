from credentials import TEST_NEW, TEST_OLD, TEST_SECRET, login_form, with_credential, with_new_credential, CREDENTIAL_FIELD


def test_quotes_crud(client):
    # 1. Register and login admin user
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "admin@workhive.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "Admin User",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    login_response = client.post(
        "/api/v1/auth/login",
        data=login_form("admin@workhive.com", TEST_SECRET),
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Company
    company_response = client.post(
        "/api/v1/companies/",
        json={
            "name": "WorkHive SL",
            "tax_id": "B12345678",
            "address": "Calle Falsa 123",
            "phone": "911234567",
            "email": "info@workhive.com",
        },
        headers=headers,
    )
    assert company_response.status_code == 201

    # 3. Create Client
    client_response = client.post(
        "/api/v1/clients/",
        json={
            "name": "Client Test",
            "legal_number": "A87654321",
            "email": "client@test.com",
            "phone": "600111222",
            "address": "Calle Mayor 10",
            "city": "Madrid",
            "postal_code": "28001",
            "country": "España",
        },
        headers=headers,
    )
    assert client_response.status_code == 201
    client_id = client_response.json()["id"]

    # 4. Create Quote
    quote_response = client.post(
        "/api/v1/quotes/",
        json={
            "client_id": client_id,
            "title": "Presupuesto Limpieza",
            "valid_until": "2026-06-30T12:00:00Z",
            "notes": "Condiciones de pago a 30 días",
            "tax_rate": 0.21,
        },
        headers=headers,
    )
    assert quote_response.status_code == 201
    quote_data = quote_response.json()
    assert quote_data["title"] == "Presupuesto Limpieza"
    assert quote_data["status"] == "draft"
    assert quote_data["base_amount"] == 0.0
    quote_id = quote_data["id"]

    # 5. Add Quote Item
    item_response = client.post(
        f"/api/v1/quotes/{quote_id}/items",
        json={
            "description": "Limpieza general",
            "quantity": 10.0,
            "unit_price": 15.0,
        },
        headers=headers,
    )
    assert item_response.status_code == 201
    item_data = item_response.json()
    assert item_data["description"] == "Limpieza general"
    assert item_data["subtotal"] == 150.0

    # 6. Verify Quote totals updated
    get_quote_resp = client.get(f"/api/v1/quotes/{quote_id}", headers=headers)
    assert get_quote_resp.status_code == 200
    q_data = get_quote_resp.json()
    assert q_data["base_amount"] == 150.0
    assert q_data["tax_amount"] == 31.5
    assert q_data["total_amount"] == 181.5
    assert len(q_data["items"]) == 1

    # 7. Update Quote Item
    item_id = item_data["id"]
    update_item_resp = client.patch(
        f"/api/v1/quotes/{quote_id}/items/{item_id}",
        json={
            "quantity": 12.0,
        },
        headers=headers,
    )
    assert update_item_resp.status_code == 200
    assert update_item_resp.json()["quantity"] == 12.0

    # 8. Verify totals updated after item update
    get_quote_resp = client.get(f"/api/v1/quotes/{quote_id}", headers=headers)
    assert get_quote_resp.json()["base_amount"] == 180.0

    # 9. Update Quote
    update_response = client.patch(
        f"/api/v1/quotes/{quote_id}",
        json={
            "title": "Presupuesto Limpieza Premium",
        },
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Presupuesto Limpieza Premium"

    # 10. List Quotes
    list_response = client.get("/api/v1/quotes/", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    # 11. Delete Item
    delete_item_resp = client.delete(
        f"/api/v1/quotes/{quote_id}/items/{item_id}",
        headers=headers,
    )
    assert delete_item_resp.status_code == 204

    # 12. Verify Quote totals are zero again
    get_quote_resp = client.get(f"/api/v1/quotes/{quote_id}", headers=headers)
    assert get_quote_resp.json()["base_amount"] == 0.0

    # 13. Delete Quote
    delete_resp = client.delete(f"/api/v1/quotes/{quote_id}", headers=headers)
    assert delete_resp.status_code == 204

    # 14. Verify deleted quote is not listed
    list_response = client.get("/api/v1/quotes/", headers=headers)
    assert len(list_response.json()) == 0
