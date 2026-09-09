from app.models.task_item import TaskItem

from credentials import CREDENTIAL_FIELD, TEST_SECRET, login_form


def _authenticated_company(client, *, email: str, name: str, tax_id: str):
    registration = client.post(
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
    assert registration.status_code == 201, registration.text
    login = client.post("/api/v1/auth/login", data=login_form(email, TEST_SECRET))
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        json={
            "name": name,
            "tax_id": tax_id,
            "address": "Calle de los Contratos 1",
            "phone": "+34600111333",
            "email": email,
        },
        headers=headers,
    )
    assert company.status_code == 201, company.text
    return headers


def _client(client, headers, *, name: str = "Cliente contractual"):
    response = client.post(
        "/api/v1/clients/",
        json={
            "name": name,
            "address": "Calle Cliente 12",
            "city": "Girona",
            "postal_code": "17001",
            "country": "España",
            "email": "cliente.contract@example.com",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _location(client, headers, client_id: int, *, name: str = "Sede contractual", spaces=None):
    response = client.post(
        "/api/v1/locations/",
        json={
            "name": name,
            "address": "Avenida Ubicación 9",
            "city": "Girona",
            "postal_code": "17002",
            "location_type": "office",
            "client_id": client_id,
            "spaces": spaces or [],
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _accepted_quote(client, headers, client_id: int):
    quote = client.post(
        "/api/v1/quotes/",
        json={
            "client_id": client_id,
            "title": "Limpieza recurrente de oficinas",
            "items": [
                {
                    "description": "Servicio semanal de limpieza",
                    "quantity": 4,
                    "unit_price": 82.5,
                }
            ],
        },
        headers=headers,
    )
    assert quote.status_code == 201, quote.text
    quote_id = quote.json()["id"]
    sent = client.patch(
        f"/api/v1/quotes/{quote_id}",
        json={"status": "sent"},
        headers=headers,
    )
    assert sent.status_code == 200, sent.text
    accepted = client.post(
        f"/api/v1/quotes/{quote_id}/accept",
        json={"register_client": False},
        headers=headers,
    )
    assert accepted.status_code == 200, accepted.text
    return accepted.json()


def test_accepted_quote_creates_one_draft_contract_with_immutable_service_lines(client, db):
    owner_headers = _authenticated_company(
        client,
        email="contract-owner@example.com",
        name="Contratos Owner",
        tax_id="B10000051",
    )
    other_headers = _authenticated_company(
        client,
        email="contract-outsider@example.com",
        name="Contratos Ajeno",
        tax_id="B10000052",
    )
    customer = _client(client, owner_headers)
    quote = _accepted_quote(client, owner_headers, customer["id"])

    contracts = client.get("/api/v1/service-contracts/", headers=owner_headers)
    assert contracts.status_code == 200, contracts.text
    assert len(contracts.json()) == 1
    contract = contracts.json()[0]
    assert contract["status"] == "draft"
    assert contract["source_quote_id"] == quote["id"]
    assert contract["source_quote_revision_id"] == quote["accepted_revision_id"]
    assert contract["service_lines"] == [
        {
            "id": contract["service_lines"][0]["id"],
            "position": 1,
            "description": "Servicio semanal de limpieza",
            "quantity": 4.0,
            "unit_price": 82.5,
            "subtotal": 330.0,
        }
    ]
    assert db.query(TaskItem).count() == 0

    # Tenant isolation applies to direct reads and the source-quote recovery
    # action, not merely to the list response.
    assert (
        client.get(
            f"/api/v1/service-contracts/{contract['id']}", headers=other_headers
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/service-contracts/from-quote/{quote['id']}",
            headers=other_headers,
        ).status_code
        == 404
    )

    recovered = client.post(
        f"/api/v1/service-contracts/from-quote/{quote['id']}",
        headers=owner_headers,
    )
    assert recovered.status_code == 201, recovered.text
    assert recovered.json()["id"] == contract["id"]
    assert db.query(TaskItem).count() == 0


def test_contract_requires_matching_client_locations_before_activation(client):
    headers = _authenticated_company(
        client,
        email="contract-locations@example.com",
        name="Contratos Ubicaciones",
        tax_id="B10000053",
    )
    customer = _client(client, headers, name="Cliente cubierto")
    other_customer = _client(client, headers, name="Cliente ajeno")
    covered_location = _location(
        client,
        headers,
        customer["id"],
        spaces=[
            {"name": "Recepción", "space_type": "reception"},
            {"name": "Oficina principal", "space_type": "office"},
        ],
    )
    other_location = _location(
        client,
        headers,
        other_customer["id"],
        name="Sede ajena",
        spaces=[{"name": "Zona ajena", "space_type": "office"}],
    )
    _accepted_quote(client, headers, customer["id"])
    contract = client.get("/api/v1/service-contracts/", headers=headers).json()[0]

    candidates = client.get(
        f"/api/v1/service-contracts/{contract['id']}/location-candidates",
        headers=headers,
    )
    assert candidates.status_code == 200, candidates.text
    assert [location["id"] for location in candidates.json()] == [covered_location["id"]]

    assert (
        client.post(
            f"/api/v1/service-contracts/{contract['id']}/activate",
            headers=headers,
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/api/v1/service-contracts/{contract['id']}/locations",
            json={"location_ids": [other_location["id"]]},
            headers=headers,
        ).status_code
        == 422
    )

    attached = client.post(
        f"/api/v1/service-contracts/{contract['id']}/locations",
        json={"location_ids": [covered_location["id"]]},
        headers=headers,
    )
    assert attached.status_code == 200, attached.text
    assert attached.json()["covered_locations"][0]["location_id"] == covered_location["id"]
    assert attached.json()["covered_locations"][0]["location_name"] == "Sede contractual"

    covered_zones = client.get(
        f"/api/v1/service-contracts/{contract['id']}/locations/{covered_location['id']}/zone-candidates",
        headers=headers,
    )
    assert covered_zones.status_code == 200, covered_zones.text
    assert [zone["name"] for zone in covered_zones.json()] == [
        "Recepción",
        "Oficina principal",
    ]
    other_zone = client.get(
        f"/api/v1/service-contracts/{contract['id']}/locations/{other_location['id']}/zone-candidates",
        headers=headers,
    )
    assert other_zone.status_code == 404

    invalid_zone = client.put(
        f"/api/v1/service-contracts/{contract['id']}/locations/{covered_location['id']}/zones",
        json={"zone_ids": [999999]},
        headers=headers,
    )
    assert invalid_zone.status_code == 422
    restricted = client.put(
        f"/api/v1/service-contracts/{contract['id']}/locations/{covered_location['id']}/zones",
        json={"zone_ids": [covered_zones.json()[0]["id"]]},
        headers=headers,
    )
    assert restricted.status_code == 200, restricted.text
    assert restricted.json()["covered_locations"][0]["covered_zones"][0]["zone_name"] == "Recepción"

    whole_location = client.put(
        f"/api/v1/service-contracts/{contract['id']}/locations/{covered_location['id']}/zones",
        json={"zone_ids": []},
        headers=headers,
    )
    assert whole_location.status_code == 200, whole_location.text
    assert whole_location.json()["covered_locations"][0]["covered_zones"] == []

    updated = client.patch(
        f"/api/v1/service-contracts/{contract['id']}",
        json={
            "renewal_mode": "automatic",
            "renewal_notice_days": 45,
            "response_time_hours": 8,
            "resolution_time_hours": 24,
            "service_window": "Lunes a viernes, 08:00–18:00",
        },
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["renewal_mode"] == "automatic"
    assert updated.json()["response_time_hours"] == 8

    activated = client.post(
        f"/api/v1/service-contracts/{contract['id']}/activate",
        headers=headers,
    )
    assert activated.status_code == 200, activated.text
    assert activated.json()["status"] == "active"
    assert activated.json()["starts_at"] is not None

    removed = client.delete(
        f"/api/v1/service-contracts/{contract['id']}/locations/{covered_location['id']}",
        headers=headers,
    )
    assert removed.status_code == 200, removed.text
    assert removed.json()["covered_locations"][0]["is_active"] is False
