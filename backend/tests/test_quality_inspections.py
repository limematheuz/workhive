from tests.test_client_permission_authorization import (
    _assign_company_profile,
    _bootstrap_admin,
    _company,
    _headers,
    _user,
)
from tests.test_quality_templates import _location, _payload


TEMPLATE_READ = "quality.templates.read"
TEMPLATE_MANAGE = "quality.templates.manage"
INSPECTION_READ = "quality.inspections.read"
INSPECTION_MANAGE = "quality.inspections.manage"


def _template(client, admin, location_id: int, title: str = "Salida") -> dict:
    response = client.post(
        "/api/v1/quality/templates/",
        headers=_headers(admin),
        json=_payload(location_id, title),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_inspection_snapshots_template_and_requires_required_points(client, db):
    company = _company(db, "inspection-owner")
    admin = _bootstrap_admin(db, company, "inspection-admin")
    location = _location(db, company, "Vivienda a inspeccionar")
    template = _template(client, admin, location.id)

    created = client.post(
        "/api/v1/quality/inspections/",
        headers=_headers(admin),
        json={"template_id": template["id"], "location_id": location.id},
    )
    assert created.status_code == 201, created.text
    inspection = created.json()
    assert inspection["status"] == "draft"
    assert inspection["template_title"] == "Salida"
    assert inspection["max_score"] == 5
    assert inspection["score"] == 0

    changed_template = client.patch(
        f"/api/v1/quality/templates/{template['id']}",
        headers=_headers(admin),
        json={"title": "Salida actualizada", "items": [{"title": "Otro punto", "max_points": 1}]},
    )
    assert changed_template.status_code == 200, changed_template.text
    stored = client.get(
        f"/api/v1/quality/inspections/{inspection['id']}", headers=_headers(admin)
    )
    assert stored.status_code == 200, stored.text
    assert stored.json()["template_title"] == "Salida"
    assert [item["title"] for item in stored.json()["items"]] == ["Revisar baños", "Revisar cocina"]

    incomplete = client.post(
        f"/api/v1/quality/inspections/{inspection['id']}/complete",
        headers=_headers(admin),
        json={"items": [{"id": inspection["items"][1]["id"], "status": "passed", "points_awarded": 2}]},
    )
    assert incomplete.status_code == 422
    completed = client.post(
        f"/api/v1/quality/inspections/{inspection['id']}/complete",
        headers=_headers(admin),
        json={
            "notes": "Todo revisado",
            "items": [
                {"id": inspection["items"][0]["id"], "status": "passed", "points_awarded": 3},
                {"id": inspection["items"][1]["id"], "status": "failed", "points_awarded": 0, "notes": "Pendiente"},
            ],
        },
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
    assert completed.json()["score"] == 3
    assert completed.json()["max_score"] == 5
    assert client.post(
        f"/api/v1/quality/inspections/{inspection['id']}/complete",
        headers=_headers(admin),
        json={"items": [{"id": inspection["items"][0]["id"], "status": "passed", "points_awarded": 3}]},
    ).status_code == 409


def test_inspection_scopes_and_cross_company_reads_are_denied(client, db):
    company = _company(db, "inspection-scoped")
    other_company = _company(db, "inspection-other")
    admin = _bootstrap_admin(db, company, "inspection-scoped-admin")
    other_admin = _bootstrap_admin(db, other_company, "inspection-other-admin")
    worker = _user(db, company, "inspection-scoped-worker", role_id=3)
    first_location = _location(db, company, "Calidad A")
    second_location = _location(db, company, "Calidad B")
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=worker,
        name="Inspector Calidad A",
        permission_codes={TEMPLATE_READ, TEMPLATE_MANAGE, INSPECTION_READ, INSPECTION_MANAGE},
        scope_type="location",
        scope_id=first_location.id,
    )
    first_template = _template(client, admin, first_location.id, "A")
    second_template = _template(client, admin, second_location.id, "B")

    created = client.post(
        "/api/v1/quality/inspections/",
        headers=_headers(worker),
        json={"template_id": first_template["id"], "location_id": first_location.id},
    )
    assert created.status_code == 201, created.text
    assert client.post(
        "/api/v1/quality/inspections/",
        headers=_headers(worker),
        json={"template_id": second_template["id"], "location_id": second_location.id},
    ).status_code == 403
    assert client.get(
        f"/api/v1/quality/inspections/{created.json()['id']}", headers=_headers(other_admin)
    ).status_code == 404
    listed = client.get("/api/v1/quality/inspections/", headers=_headers(worker))
    assert listed.status_code == 200, listed.text
    assert [item["location_id"] for item in listed.json()] == [first_location.id]
