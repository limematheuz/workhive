from tests.test_client_permission_authorization import (
    _assign_company_profile,
    _bootstrap_admin,
    _company,
    _headers,
    _user,
)
from tests.test_quality_inspections import _template
from tests.test_quality_templates import _location


QUALITY_CODES = {
    "quality.templates.read",
    "quality.templates.manage",
    "quality.inspections.read",
    "quality.inspections.manage",
    "quality.incidents.read",
    "quality.incidents.manage",
}


def _inspection(client, admin, location_id: int) -> dict:
    template = _template(client, admin, location_id, "Inspección con incidencia")
    response = client.post(
        "/api/v1/quality/inspections/",
        headers=_headers(admin),
        json={"template_id": template["id"], "location_id": location_id},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_incident_tracks_corrective_actions_without_changing_inspection_history(client, db):
    company = _company(db, "incident-owner")
    admin = _bootstrap_admin(db, company, "incident-admin")
    location = _location(db, company, "Oficina con incidencia")
    inspection = _inspection(client, admin, location.id)

    created = client.post(
        "/api/v1/quality/incidents/",
        headers=_headers(admin),
        json={
            "location_id": location.id,
            "inspection_id": inspection["id"],
            "inspection_item_id": inspection["items"][0]["id"],
            "title": "Baño incompleto",
            "severity": "high",
        },
    )
    assert created.status_code == 201, created.text
    incident = created.json()
    assert incident["status"] == "open"
    assert incident["inspection_id"] == inspection["id"]

    action = client.post(
        f"/api/v1/quality/incidents/{incident['id']}/actions",
        headers=_headers(admin),
        json={"title": "Revisar antes de las 18:00"},
    )
    assert action.status_code == 201, action.text
    completed_action = client.patch(
        f"/api/v1/quality/incidents/{incident['id']}/actions/{action.json()['id']}",
        headers=_headers(admin),
        json={"status": "completed"},
    )
    assert completed_action.status_code == 200, completed_action.text
    assert completed_action.json()["completed_at"] is not None

    cancelled_action = client.patch(
        f"/api/v1/quality/incidents/{incident['id']}/actions/{action.json()['id']}",
        headers=_headers(admin),
        json={"status": "cancelled"},
    )
    assert cancelled_action.status_code == 200, cancelled_action.text
    assert cancelled_action.json()["status"] == "cancelled"
    assert cancelled_action.json()["completed_at"] is None

    resolved = client.patch(
        f"/api/v1/quality/incidents/{incident['id']}",
        headers=_headers(admin),
        json={"status": "resolved"},
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["resolved_at"] is not None
    assert resolved.json()["corrective_actions"][0]["status"] == "cancelled"
    assert client.get(
        f"/api/v1/quality/inspections/{inspection['id']}", headers=_headers(admin)
    ).json()["status"] == "draft"


def test_incidents_fail_closed_to_company_and_location_scope(client, db):
    company = _company(db, "incident-scoped")
    other_company = _company(db, "incident-other")
    admin = _bootstrap_admin(db, company, "incident-admin")
    other_admin = _bootstrap_admin(db, other_company, "incident-other-admin")
    worker = _user(db, company, "incident-worker", role_id=3)
    first_location = _location(db, company, "Calidad incidentes A")
    second_location = _location(db, company, "Calidad incidentes B")
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=worker,
        name="Calidad incidentes A",
        permission_codes=QUALITY_CODES,
        scope_type="location",
        scope_id=first_location.id,
    )
    first = client.post(
        "/api/v1/quality/incidents/",
        headers=_headers(admin),
        json={"location_id": first_location.id, "title": "Primera"},
    )
    second = client.post(
        "/api/v1/quality/incidents/",
        headers=_headers(admin),
        json={"location_id": second_location.id, "title": "Segunda"},
    )
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text

    listed = client.get("/api/v1/quality/incidents/", headers=_headers(worker))
    assert listed.status_code == 200, listed.text
    assert [item["id"] for item in listed.json()] == [first.json()["id"]]
    assert client.get(
        f"/api/v1/quality/incidents/{second.json()['id']}", headers=_headers(worker)
    ).status_code == 403
    assert client.patch(
        f"/api/v1/quality/incidents/{second.json()['id']}",
        headers=_headers(worker),
        json={"status": "resolved"},
    ).status_code == 403
    assert client.get(
        f"/api/v1/quality/incidents/{first.json()['id']}", headers=_headers(other_admin)
    ).status_code == 404
