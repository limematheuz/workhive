from app.models.client import Client
from app.models.quality_complaint import QualityComplaint
from tests.test_client_permission_authorization import (
    _assign_company_profile,
    _bootstrap_admin,
    _company,
    _headers,
    _user,
)
from tests.test_quality_templates import _location


COMPLAINT_CODES = {"quality.complaints.read", "quality.complaints.manage"}


def _customer_location(db, company, suffix: str):
    customer = Client(
        name=f"Cliente reclamación {suffix}",
        address="Calle Cliente 1",
        city="Madrid",
        postal_code="28001",
        country="España",
        company_id=company.id,
    )
    db.add(customer)
    db.flush()
    location = _location(db, company, f"Ubicación reclamación {suffix}")
    location.client_id = customer.id
    db.commit()
    return customer, location


def test_complaints_are_scoped_to_the_customer_location_and_keep_internal_notes_private(client, db):
    company = _company(db, "complaint-owner")
    other_company = _company(db, "complaint-other")
    admin = _bootstrap_admin(db, company, "complaint-admin")
    other_admin = _bootstrap_admin(db, other_company, "complaint-other-admin")
    customer, location = _customer_location(db, company, "owner")

    created = client.post(
        "/api/v1/quality/complaints/",
        headers=_headers(admin),
        json={
            "location_id": location.id,
            "title": "Servicio incompleto",
            "description": "Faltó terminar la zona de recepción.",
            "category": "service",
        },
    )
    assert created.status_code == 201, created.text
    complaint = created.json()
    assert complaint["client_id"] == customer.id
    assert complaint["source"] == "internal"
    assert complaint["status"] == "submitted"

    resolved = client.patch(
        f"/api/v1/quality/complaints/{complaint['id']}",
        headers=_headers(admin),
        json={
            "status": "resolved",
            "customer_response": "Hemos revisado el servicio y repetiremos la zona.",
            "internal_notes": "Programar revisión del responsable.",
        },
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["resolved_at"] is not None
    assert resolved.json()["internal_notes"] == "Programar revisión del responsable."
    assert client.get(
        f"/api/v1/quality/complaints/{complaint['id']}", headers=_headers(other_admin)
    ).status_code == 404


def test_complaints_fail_closed_to_location_scope_and_require_a_client_location(client, db):
    company = _company(db, "complaint-scoped")
    admin = _bootstrap_admin(db, company, "complaint-admin")
    worker = _user(db, company, "complaint-worker", role_id=3)
    customer, first_location = _customer_location(db, company, "first")
    _, second_location = _customer_location(db, company, "second")
    non_client_location = _location(db, company, "Ubicación interna")
    _assign_company_profile(
        db,
        company=company,
        admin=admin,
        user=worker,
        name="Reclamaciones acotadas",
        permission_codes=COMPLAINT_CODES,
        scope_type="location",
        scope_id=first_location.id,
    )

    assert client.post(
        "/api/v1/quality/complaints/",
        headers=_headers(admin),
        json={"location_id": non_client_location.id, "title": "No procede", "description": "Sin cliente"},
    ).status_code == 422
    first = client.post(
        "/api/v1/quality/complaints/",
        headers=_headers(admin),
        json={"location_id": first_location.id, "title": "Primera", "description": "Detalle"},
    )
    second = client.post(
        "/api/v1/quality/complaints/",
        headers=_headers(admin),
        json={"location_id": second_location.id, "title": "Segunda", "description": "Detalle"},
    )
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text

    listed = client.get("/api/v1/quality/complaints/", headers=_headers(worker))
    assert listed.status_code == 200, listed.text
    assert [item["id"] for item in listed.json()] == [first.json()["id"]]
    assert client.patch(
        f"/api/v1/quality/complaints/{second.json()['id']}",
        headers=_headers(worker),
        json={"status": "in_review"},
    ).status_code == 403
    stored = db.get(QualityComplaint, first.json()["id"])
    assert stored is not None and stored.client_id == customer.id
