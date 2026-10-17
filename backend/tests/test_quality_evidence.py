from io import BytesIO

from PIL import Image

from app.models.quality_evidence import QualityEvidence
from app.services.quality_evidence_service import MAX_QUALITY_EVIDENCE_BYTES
from tests.test_client_permission_authorization import (
    _assign_company_profile,
    _bootstrap_admin,
    _company,
    _headers,
    _user,
)
from tests.test_quality_incidents import _inspection
from tests.test_quality_templates import _location


QUALITY_CODES = {
    "quality.templates.read",
    "quality.templates.manage",
    "quality.inspections.read",
    "quality.inspections.manage",
    "quality.incidents.read",
    "quality.incidents.manage",
}


def _png() -> bytes:
    output = BytesIO()
    Image.new("RGB", (8, 8), color="blue").save(output, format="PNG")
    return output.getvalue()


def _incident(client, admin, location_id: int) -> dict:
    response = client.post(
        "/api/v1/quality/incidents/",
        headers=_headers(admin),
        json={"location_id": location_id, "title": "Incidencia con evidencia"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_quality_evidence_is_private_to_its_inspection_or_incident(client, db):
    company = _company(db, "quality-evidence-owner")
    admin = _bootstrap_admin(db, company, "quality-evidence-admin")
    location = _location(db, company, "Ubicación con evidencias")
    inspection = _inspection(client, admin, location.id)
    incident = _incident(client, admin, location.id)

    inspection_upload = client.post(
        f"/api/v1/quality/inspections/{inspection['id']}/evidence",
        headers=_headers(admin),
        data={"caption": "Baño revisado"},
        files={"file": ("bano.png", _png(), "image/png")},
    )
    assert inspection_upload.status_code == 201, inspection_upload.text
    inspection_evidence = inspection_upload.json()
    assert inspection_evidence["caption"] == "Baño revisado"
    assert inspection_evidence["file_name"] == "bano.png"
    assert inspection_evidence["media_url"] == (
        f"/api/v1/quality/inspections/{inspection['id']}/evidence/"
        f"{inspection_evidence['id']}/media"
    )
    assert "media_key" not in inspection_evidence

    inspection_read = client.get(
        f"/api/v1/quality/inspections/{inspection['id']}", headers=_headers(admin)
    )
    assert inspection_read.status_code == 200, inspection_read.text
    assert inspection_read.json()["evidence"] == [inspection_evidence]
    inspection_media = client.get(inspection_evidence["media_url"], headers=_headers(admin))
    assert inspection_media.status_code == 200
    assert inspection_media.headers["content-type"] == "image/png"
    assert "no-store" in inspection_media.headers["cache-control"]
    assert inspection_media.content == _png()

    incident_upload = client.post(
        f"/api/v1/quality/incidents/{incident['id']}/evidence",
        headers=_headers(admin),
        files={"file": ("desviacion.png", _png(), "image/png")},
    )
    assert incident_upload.status_code == 201, incident_upload.text
    incident_evidence = incident_upload.json()
    incident_read = client.get(
        f"/api/v1/quality/incidents/{incident['id']}", headers=_headers(admin)
    )
    assert incident_read.status_code == 200, incident_read.text
    assert incident_read.json()["evidence"] == [incident_evidence]
    incident_media = client.get(incident_evidence["media_url"], headers=_headers(admin))
    assert incident_media.status_code == 200
    assert "no-store" in incident_media.headers["cache-control"]


def test_quality_evidence_fails_closed_to_location_and_generic_media_access(client, db):
    company = _company(db, "quality-evidence-scoped")
    other_company = _company(db, "quality-evidence-other")
    admin = _bootstrap_admin(db, company, "quality-evidence-owner-admin")
    other_admin = _bootstrap_admin(db, other_company, "quality-evidence-other-admin")
    worker = _user(db, company, "quality-evidence-worker", role_id=3)
    first_location = _location(db, company, "Evidencia permitida")
    second_location = _location(db, company, "Evidencia restringida")
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=worker,
        name="Inspector de evidencia",
        permission_codes=QUALITY_CODES,
        scope_type="location",
        scope_id=first_location.id,
    )
    first_inspection = _inspection(client, admin, first_location.id)
    second_inspection = _inspection(client, admin, second_location.id)
    upload = client.post(
        f"/api/v1/quality/inspections/{first_inspection['id']}/evidence",
        headers=_headers(worker),
        files={"file": ("permitida.png", _png(), "image/png")},
    )
    assert upload.status_code == 201, upload.text
    evidence = upload.json()

    assert client.get(evidence["media_url"], headers=_headers(worker)).status_code == 200
    assert client.get(evidence["media_url"], headers=_headers(other_admin)).status_code == 404
    assert client.post(
        f"/api/v1/quality/inspections/{second_inspection['id']}/evidence",
        headers=_headers(worker),
        files={"file": ("restringida.png", _png(), "image/png")},
    ).status_code == 403
    assert client.get(
        f"/api/v1/quality/inspections/{second_inspection['id']}/evidence/9999/media",
        headers=_headers(worker),
    ).status_code == 403

    stored = db.query(QualityEvidence).filter_by(id=evidence["id"]).one()
    assert client.get(
        f"/api/v1/uploads/media/{stored.media_key}", headers=_headers(worker)
    ).status_code == 404


def test_quality_evidence_rejects_invalid_images(client, db):
    company = _company(db, "quality-evidence-invalid")
    admin = _bootstrap_admin(db, company, "quality-evidence-invalid-admin")
    location = _location(db, company, "Ubicación con evidencia inválida")
    inspection = _inspection(client, admin, location.id)

    response = client.post(
        f"/api/v1/quality/inspections/{inspection['id']}/evidence",
        headers=_headers(admin),
        files={"file": ("falsa.png", b"not-an-image", "image/png")},
    )
    assert response.status_code == 400


def test_quality_evidence_rejects_images_over_one_megabyte(client, db):
    company = _company(db, "quality-evidence-too-large")
    admin = _bootstrap_admin(db, company, "quality-evidence-too-large-admin")
    location = _location(db, company, "Ubicación con evidencia demasiado grande")
    inspection = _inspection(client, admin, location.id)

    response = client.post(
        f"/api/v1/quality/inspections/{inspection['id']}/evidence",
        headers=_headers(admin),
        files={
            "file": (
                "demasiado-grande.png",
                b"x" * (MAX_QUALITY_EVIDENCE_BYTES + 1),
                "image/png",
            )
        },
    )
    assert response.status_code == 413
    assert response.json()["detail"] == "La foto de evidencia no puede superar 1 MB"
