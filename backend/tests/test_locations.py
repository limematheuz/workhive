from credentials import TEST_SECRET, login_form, CREDENTIAL_FIELD


def test_company_can_create_location_without_client(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "location-admin@workhive.com",
            CREDENTIAL_FIELD: TEST_SECRET,
            "full_name": "Location Admin",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    login = client.post(
        "/api/v1/auth/login",
        data=login_form("location-admin@workhive.com", TEST_SECRET),
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company_response = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": "Servicios Multisector",
            "tax_id": "B55555555",
            "address": "Calle Trabajo 5",
            "phone": "600500500",
            "email": "admin@multisector.com",
        },
    )
    assert company_response.status_code == 201, company_response.text
    company = company_response.json()
    me_response = client.get("/api/v1/users/me", headers=headers)
    assert me_response.status_code == 200, me_response.text
    assert me_response.json()["role"]["name"] == "admin"

    response = client.post(
        "/api/v1/locations/",
        headers=headers,
        json={
            "name": "Piscina comunitaria",
            "address": "Avenida del Mar 20",
            "city": "Girona",
            "postal_code": "17001",
            "location_type": "outdoor",
            "client_id": None,
            "managing_company_id": 999,
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["client_id"] is None
    assert response.json()["owner_company_id"] == company["id"]
    assert response.json()["managing_company_id"] == company["id"]

    listed = client.get("/api/v1/locations/", headers=headers)
    assert listed.status_code == 200
    assert [location["id"] for location in listed.json()] == [response.json()["id"]]

    updated = client.patch(
        f"/api/v1/locations/{response.json()['id']}",
        headers=headers,
        json={
            "name": "Piscina comunitaria renovada",
            "managing_company_id": None,
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["managing_company_id"] == company["id"]

    listed_after_update = client.get("/api/v1/locations/", headers=headers)
    assert listed_after_update.status_code == 200
    assert [location["id"] for location in listed_after_update.json()] == [
        response.json()["id"]
    ]
