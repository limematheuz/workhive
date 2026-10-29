from app.models.location import Location
from app.services import organization_bootstrap_service
from tests.test_client_permission_authorization import (
    _assign_company_profile,
    _bootstrap_admin,
    _company,
    _headers,
    _user,
)


QUALITY_READ = "quality.templates.read"
QUALITY_MANAGE = "quality.templates.manage"


def _location(db, company, name: str) -> Location:
    location = Location(
        name=name,
        address="Calle de calidad 1",
        city="Madrid",
        managing_company_id=company.id,
        owner_company_id=company.id,
    )
    db.add(location)
    db.commit()
    return location


def _payload(location_id: int, title: str = "Inspección de salida") -> dict:
    return {
        "location_id": location_id,
        "title": title,
        "description": "Antes de entregar la vivienda",
        "items": [
            {"title": "Revisar baños", "guidance": "Sin restos visibles", "max_points": 3},
            {"title": "Revisar cocina", "is_required": False, "max_points": 2},
        ],
    }


def test_quality_template_is_scoped_to_location_and_company(client, db):
    owner_company = _company(db, "quality-owner")
    other_company = _company(db, "quality-other")
    admin = _bootstrap_admin(db, owner_company, "quality-admin")
    other_admin = _bootstrap_admin(db, other_company, "quality-other-admin")
    location = _location(db, owner_company, "Apartamento inspección")

    created = client.post(
        "/api/v1/quality/templates/",
        headers=_headers(admin),
        json=_payload(location.id),
    )
    assert created.status_code == 201, created.text
    template = created.json()
    assert template["location_id"] == location.id
    assert [item["position"] for item in template["items"]] == [0, 1]
    assert [item["max_points"] for item in template["items"]] == [3, 2]

    listed = client.get("/api/v1/quality/templates/", headers=_headers(admin))
    assert listed.status_code == 200, listed.text
    assert [item["id"] for item in listed.json()] == [template["id"]]
    assert client.get(
        f"/api/v1/quality/templates/{template['id']}", headers=_headers(other_admin)
    ).status_code == 404


def test_quality_template_custom_profile_only_sees_its_location(client, db):
    company = _company(db, "quality-scoped")
    admin = _bootstrap_admin(db, company, "quality-scoped-admin")
    worker = _user(db, company, "quality-scoped-worker", role_id=3)
    first_location = _location(db, company, "Centro A")
    second_location = _location(db, company, "Centro B")
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=worker,
        name="Calidad Centro A",
        permission_codes={QUALITY_READ, QUALITY_MANAGE},
        scope_type="location",
        scope_id=first_location.id,
    )

    first = client.post(
        "/api/v1/quality/templates/",
        headers=_headers(admin),
        json=_payload(first_location.id, "Centro A"),
    )
    second = client.post(
        "/api/v1/quality/templates/",
        headers=_headers(admin),
        json=_payload(second_location.id, "Centro B"),
    )
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text

    listed = client.get("/api/v1/quality/templates/", headers=_headers(worker))
    assert listed.status_code == 200, listed.text
    assert [item["title"] for item in listed.json()] == ["Centro A"]
    assert client.get(
        f"/api/v1/quality/templates/{second.json()['id']}", headers=_headers(worker)
    ).status_code == 403
    assert client.patch(
        f"/api/v1/quality/templates/{second.json()['id']}",
        headers=_headers(worker),
        json={"title": "Intento bloqueado"},
    ).status_code == 403

    updated = client.patch(
        f"/api/v1/quality/templates/{first.json()['id']}",
        headers=_headers(worker),
        json={"items": [{"title": "Nuevo punto", "max_points": 4}]},
    )
    assert updated.status_code == 200, updated.text
    assert [(item["position"], item["title"]) for item in updated.json()["items"]] == [(0, "Nuevo punto")]


def test_quality_template_fails_closed_without_quality_profile(client, db):
    company = _company(db, "quality-denied")
    admin = _bootstrap_admin(db, company, "quality-denied-admin")
    worker = _user(db, company, "quality-denied-worker", role_id=3)
    organization_bootstrap_service.ensure_user_membership(db, worker)
    db.commit()
    location = _location(db, company, "Centro cerrado")

    assert client.get("/api/v1/quality/templates/", headers=_headers(worker)).status_code == 403
    assert client.post(
        "/api/v1/quality/templates/",
        headers=_headers(worker),
        json=_payload(location.id),
    ).status_code == 403
    assert client.post(
        "/api/v1/quality/templates/",
        headers=_headers(admin),
        json={**_payload(location.id), "items": []},
    ).status_code == 422


def test_quality_template_rejects_null_required_fields_and_preserves_items(client, db):
    company = _company(db, "quality-required")
    admin = _bootstrap_admin(db, company, "quality-required-admin")
    location = _location(db, company, "QA template")
    headers = _headers(admin)
    created = client.post("/api/v1/quality/templates/", headers=headers, json=_payload(location.id))
    assert created.status_code == 201, created.text
    original = created.json()
    url = f"/api/v1/quality/templates/{original['id']}"
    for field in ("title", "is_active", "items"):
        rejected = client.patch(url, headers=headers, json={field: None, "description": "must not persist"})
        assert rejected.status_code == 422, (field, rejected.text)
        assert client.get(url, headers=headers).json() == original
    updated = client.patch(url, headers=headers, json={"description": None, "is_active": False})
    assert updated.status_code == 200, updated.text
    assert updated.json()["description"] is None
    assert updated.json()["is_active"] is False
    assert updated.json()["items"] == original["items"]
