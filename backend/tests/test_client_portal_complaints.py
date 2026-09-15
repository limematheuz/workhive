from app.models.audit_log import AuditLog
from app.models.quality_complaint import QualityComplaint
from tests.test_client_portal_api import (
    _client,
    _company,
    _completed_inspection,
    _grant,
    _internal_user,
    _portal_user,
)


def test_client_portal_submits_only_its_own_location_and_never_receives_internal_notes(client, db):
    company = _company(db, "COMPLAINT-PORTAL")
    admin, _ = _internal_user(db, company=company, suffix="COMPLAINT-PORTAL")
    customer = _client(db, company=company, suffix="COMPLAINT-PORTAL")
    other_customer = _client(db, company=company, suffix="COMPLAINT-OTHER")
    portal_user, headers = _portal_user(
        db, email="complaints@example.com", suffix="COMPLAINT-PORTAL"
    )
    grant = _grant(db, company=company, customer=customer, user=portal_user, admin=admin)
    _grant(db, company=company, customer=other_customer, user=portal_user, admin=admin)
    own_inspection = _completed_inspection(
        db, company=company, customer=customer, suffix="COMPLAINT-PORTAL"
    )
    other_inspection = _completed_inspection(
        db, company=company, customer=other_customer, suffix="COMPLAINT-OTHER"
    )

    overview_url = f"/api/v1/client-portal/workspaces/{grant.id}/overview"
    overview = client.get(overview_url, headers=headers)
    assert overview.status_code == 200, overview.text
    assert overview.json()["complaints"] == []
    assert overview.json()["complaint_locations"] == [
        {"id": own_inspection.location_id, "name": own_inspection.location.name}
    ]

    endpoint = f"/api/v1/client-portal/workspaces/{grant.id}/complaints"
    assert client.post(
        endpoint,
        headers=headers,
        json={
            "location_id": other_inspection.location_id,
            "title": "Otra empresa",
            "description": "No debe aceptarse",
        },
    ).status_code == 404
    created = client.post(
        endpoint,
        headers=headers,
        json={
            "location_id": own_inspection.location_id,
            "title": "Limpieza pendiente",
            "description": "La recepción no quedó terminada.",
            "category": "service",
        },
    )
    assert created.status_code == 201, created.text
    public = created.json()
    assert public["status"] == "submitted"
    assert public["location_name"] == own_inspection.location.name
    assert "internal_notes" not in public
    assert "source" not in public

    stored = db.get(QualityComplaint, public["id"])
    assert stored is not None
    stored.status = "resolved"
    stored.customer_response = "Repetiremos el servicio esta tarde."
    stored.internal_notes = "No mostrar esta nota al cliente."
    db.commit()

    listed = client.get(overview_url, headers=headers)
    assert listed.status_code == 200, listed.text
    complaint = listed.json()["complaints"][0]
    assert complaint["customer_response"] == "Repetiremos el servicio esta tarde."
    assert "internal_notes" not in complaint
    assert "submitted_by_user_id" not in complaint

    audit = db.query(AuditLog).filter_by(
        action="quality_complaint.client_submitted", entity_id=str(public["id"])
    ).one()
    assert audit.actor_user_id == portal_user.id
    assert audit.details["client_id"] == customer.id
