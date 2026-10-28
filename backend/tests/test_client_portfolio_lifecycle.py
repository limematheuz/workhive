import pytest

from app.models.client import Client
from test_client_permission_authorization import _bootstrap_admin, _company, _headers


def test_portfolio_edits_archive_filters_and_duplicate_identity_preserve_tenant_data(
    client, db
):
    company = _company(db, "portfolio-lifecycle")
    headers = _headers(_bootstrap_admin(db, company, "portfolio-owner"))
    payload = {
        "name": "QA portfolio",
        "client_type": "individual",
        "address": "QA street 1",
        "city": "QA city",
        "postal_code": "00000",
        "country": "España",
        "legal_number": "QA-PORTFOLIO-001",
    }
    assert (
        client.post(
            "/api/v1/clients/", headers=headers, json={**payload, "name": "  "}
        ).status_code
        == 422
    )
    assert db.query(Client).count() == 0
    created = client.post("/api/v1/clients/", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    path = f"/api/v1/clients/{created.json()['id']}"
    assert created.json()["email"] is None
    assert created.json()["phone"] is None
    assert (
        client.post("/api/v1/clients/", headers=headers, json=payload).status_code
        == 409
    )
    assert db.query(Client).count() == 1
    updated = client.patch(
        path,
        headers=headers,
        json={"name": "  QA edited portfolio  ", "phone": "000000000"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "QA edited portfolio"
    assert updated.json()["phone"] == "000000000"
    assert client.patch(path, headers=headers, json={"name": "  "}).status_code == 422
    assert client.get(path, headers=headers).json() == updated.json()
    second = client.post(
        "/api/v1/clients/",
        headers=headers,
        json={
            **payload,
            "name": "QA second portfolio",
            "legal_number": "QA-PORTFOLIO-002",
        },
    )
    assert second.status_code == 201, second.text
    second_path = f"/api/v1/clients/{second.json()['id']}"
    assert (
        client.patch(
            second_path, headers=headers, json={"legal_number": payload["legal_number"]}
        ).status_code
        == 409
    )
    assert client.get(second_path, headers=headers).json() == second.json()
    assert client.delete(path, headers=headers).status_code == 200
    inactive = client.get("/api/v1/clients/?is_active=false", headers=headers).json()
    assert [row["id"] for row in inactive] == [created.json()["id"]]
    assert inactive[0]["name"] == "QA edited portfolio"
    assert inactive[0]["phone"] == "000000000"
    assert [
        row["id"] for row in client.get("/api/v1/clients/", headers=headers).json()
    ] == [second.json()["id"]]
    assert (
        len(
            client.get("/api/v1/clients/?include_inactive=true", headers=headers).json()
        )
        == 2
    )
    assert (
        client.post("/api/v1/clients/", headers=headers, json=payload).status_code
        == 409
    )
    restored = client.patch(path, headers=headers, json={"is_active": True})
    assert restored.status_code == 200, restored.text
    assert restored.json()["is_active"] is True
    assert restored.json()["name"] == updated.json()["name"]
    assert restored.json()["phone"] == updated.json()["phone"]
    foreign = _company(db, "portfolio-foreign")
    foreign_headers = _headers(_bootstrap_admin(db, foreign, "portfolio-foreign-owner"))
    assert (
        client.get(
            "/api/v1/clients/?include_inactive=true", headers=foreign_headers
        ).json()
        == []
    )
    for method, data in [
        ("GET", None),
        ("PATCH", {"name": "Denied"}),
        ("DELETE", None),
    ]:
        assert (
            client.request(method, path, headers=foreign_headers, json=data).status_code
            == 404
        )
    assert client.get(path).status_code == 401
    foreign_created = client.post(
        "/api/v1/clients/", headers=foreign_headers, json=payload
    )
    assert foreign_created.status_code == 201, foreign_created.text
    assert foreign_created.json()["company_id"] == foreign.id
    assert client.get(path, headers=headers).json() == restored.json()


@pytest.mark.parametrize(
    "field,value",
    [
        *[
            (field, value)
            for field in ("name", "address", "city", "postal_code", "country")
            for value in ("", "  ", None)
        ],
        *[
            (field, None)
            for field in ("client_type", "relationship_status", "is_active")
        ],
    ],
)
def test_invalid_partial_client_update_is_rejected_without_persisting_other_fields(
    client, db, field, value
):
    company = _company(db, "portfolio-invalid")
    headers = _headers(_bootstrap_admin(db, company, "portfolio-invalid-owner"))
    created = client.post(
        "/api/v1/clients/",
        headers=headers,
        json={
            "name": "QA valid",
            "address": "QA street",
            "city": "QA",
            "postal_code": "00000",
            "country": "España",
            "phone": "000000000",
        },
    )
    assert created.status_code == 201, created.text
    path = f"/api/v1/clients/{created.json()['id']}"
    rejected = client.patch(
        path, headers=headers, json={field: value, "phone": "111111111"}
    )
    assert rejected.status_code == 422, rejected.text
    assert client.get(path, headers=headers).json() == created.json()
    assert db.query(Client).count() == 1


def test_optional_client_details_can_still_be_cleared(client, db):
    company = _company(db, "portfolio-optional")
    headers = _headers(_bootstrap_admin(db, company, "portfolio-optional-owner"))
    created = client.post(
        "/api/v1/clients/",
        headers=headers,
        json={
            "name": "QA optional",
            "address": "QA street",
            "city": "QA",
            "postal_code": "00000",
            "country": "España",
            "phone": "000000000",
            "legal_number": "QA-OPTIONAL",
            "province": "QA",
            "email": "qa@example.com",
        },
    )
    assert created.status_code == 201, created.text
    cleared = client.patch(
        f"/api/v1/clients/{created.json()['id']}",
        headers=headers,
        json={"phone": None, "province": "  ", "legal_number": None, "email": None},
    )
    assert cleared.status_code == 200, cleared.text
    for field in ("phone", "province", "legal_number", "email"):
        assert cleared.json()[field] is None
    for field in (
        "name",
        "address",
        "city",
        "postal_code",
        "country",
        "client_type",
        "relationship_status",
        "is_active",
    ):
        assert cleared.json()[field] == created.json()[field]
