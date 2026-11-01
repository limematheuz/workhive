import pytest

from tests.test_client_permission_authorization import (
    _bootstrap_admin,
    _company,
    _headers,
)
from tests.test_quality_templates import _location


@pytest.mark.parametrize("field", ["title", "severity", "status"])
def test_incident_rejects_explicit_null_without_partial_updates(client, db, field):
    company = _company(db, "quality-null-incident")
    admin = _bootstrap_admin(db, company, "quality-null-incident-admin")
    location = _location(db, company, "Quality required fields")
    headers = _headers(admin)
    created = client.post(
        "/api/v1/quality/incidents/",
        headers=headers,
        json={
            "location_id": location.id,
            "title": "Preserved incident",
            "description": "Original description",
        },
    )
    assert created.status_code == 201, created.text
    original = created.json()
    url = f"/api/v1/quality/incidents/{original['id']}"
    rejected = client.patch(
        url, headers=headers, json={field: None, "description": "Must not persist"}
    )
    assert rejected.status_code == 422, rejected.text
    assert client.get(url, headers=headers).json() == original
    cleared = client.patch(url, headers=headers, json={"description": None})
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["description"] is None
    assert cleared.json()[field] == original[field]


@pytest.mark.parametrize("field", ["title", "status"])
def test_corrective_action_rejects_explicit_null_and_preserves_optional_clears(
    client, db, field
):
    company = _company(db, "quality-null-action")
    admin = _bootstrap_admin(db, company, "quality-null-action-admin")
    location = _location(db, company, "Quality action fields")
    headers = _headers(admin)
    incident = client.post(
        "/api/v1/quality/incidents/",
        headers=headers,
        json={"location_id": location.id, "title": "Action owner"},
    )
    assert incident.status_code == 201, incident.text
    incident_url = f"/api/v1/quality/incidents/{incident.json()['id']}"
    created = client.post(
        f"{incident_url}/actions",
        headers=headers,
        json={
            "title": "Preserved action",
            "description": "Original",
            "due_at": "2026-12-01T12:00:00Z",
        },
    )
    assert created.status_code == 201, created.text
    original_incident = client.get(incident_url, headers=headers).json()
    url = f"{incident_url}/actions/{created.json()['id']}"
    rejected = client.patch(
        url, headers=headers, json={field: None, "description": "Must not persist"}
    )
    assert rejected.status_code == 422, rejected.text
    assert client.get(incident_url, headers=headers).json() == original_incident
    cleared = client.patch(
        url, headers=headers, json={"description": None, "due_at": None}
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["description"] is None
    assert cleared.json()["due_at"] is None
    assert cleared.json()[field] == created.json()[field]
