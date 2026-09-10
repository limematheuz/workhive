from app.models.location import Location
from tests.test_location_workspace import _admin, _company, _headers


PDF = b"%PDF-1.4\nlocation document\n%%EOF"


def _location(db, company, name="Centro de pruebas"):
    location = Location(
        name=name,
        address="Calle Activos 1",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


def test_location_documents_are_private_validated_and_archived(client, db, monkeypatch):
    owner_company = _company(db, "AssetOwner")
    owner = _admin(db, owner_company)
    location = _location(db, owner_company)
    owner_headers = _headers(owner)

    created = client.post(
        f"/api/v1/locations/{location.id}/documents",
        headers=owner_headers,
        data={"document_type": "access"},
        files={"file": ("acceso.pdf", PDF, "application/pdf")},
    )
    assert created.status_code == 201, created.text
    document = created.json()
    assert document["name"] == "acceso.pdf"
    assert document["document_type"] == "access"
    assert len(document["sha256"]) == 64

    library = client.get("/api/v1/location-documents", headers=owner_headers)
    assert library.status_code == 200, library.text
    assert library.json() == [
        {
            **document,
            "location_id": location.id,
            "location_name": location.name,
        }
    ]

    listed = client.get(f"/api/v1/locations/{location.id}/documents", headers=owner_headers)
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [document["id"]]

    downloaded = client.get(
        f"/api/v1/locations/{location.id}/documents/{document['id']}/download",
        headers=owner_headers,
    )
    assert downloaded.status_code == 200
    assert downloaded.content == PDF
    assert downloaded.headers["cache-control"] == "private, no-store"

    invalid = client.post(
        f"/api/v1/locations/{location.id}/documents",
        headers=owner_headers,
        files={"file": ("notas.txt", b"not a document", "text/plain")},
    )
    assert invalid.status_code == 422

    from app.core.config import settings

    monkeypatch.setattr(settings, "LOCATION_DOCUMENT_COMPANY_MAX_BYTES", len(PDF))
    quota_reached = client.post(
        f"/api/v1/locations/{location.id}/documents",
        headers=owner_headers,
        files={"file": ("segundo.pdf", PDF, "application/pdf")},
    )
    assert quota_reached.status_code == 409
    assert quota_reached.headers["x-workhive-error-code"] == "location_documents.storage_limit_reached"

    archived = client.delete(
        f"/api/v1/locations/{location.id}/documents/{document['id']}", headers=owner_headers
    )
    assert archived.status_code == 204
    assert client.get(f"/api/v1/locations/{location.id}/documents", headers=owner_headers).json() == []
    assert client.get(
        f"/api/v1/locations/{location.id}/documents/{document['id']}/download", headers=owner_headers
    ).status_code == 404


def test_location_assets_reject_other_company_and_manage_equipment(client, db):
    owner_company = _company(db, "EquipmentOwner")
    other_company = _company(db, "EquipmentOther")
    owner = _admin(db, owner_company)
    other = _admin(db, other_company)
    location = _location(db, owner_company)
    owner_headers = _headers(owner)

    created = client.post(
        f"/api/v1/locations/{location.id}/equipment",
        headers=owner_headers,
        json={"name": "Aspiradora industrial", "category": "cleaning", "quantity": 2, "status": "maintenance"},
    )
    assert created.status_code == 201, created.text
    equipment = created.json()
    assert equipment["quantity"] == 2

    library = client.get("/api/v1/location-equipment", headers=owner_headers)
    assert library.status_code == 200, library.text
    assert library.json() == [
        {
            **equipment,
            "location_id": location.id,
            "location_name": location.name,
        }
    ]

    updated = client.patch(
        f"/api/v1/locations/{location.id}/equipment/{equipment['id']}",
        headers=owner_headers,
        json={"status": "active", "serial_number": "SER-1"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "active"

    denied = client.get(f"/api/v1/locations/{location.id}/equipment", headers=_headers(other))
    assert denied.status_code in {403, 404}
    denied_upload = client.post(
        f"/api/v1/locations/{location.id}/documents",
        headers=_headers(other),
        files={"file": ("acceso.pdf", PDF, "application/pdf")},
    )
    assert denied_upload.status_code in {403, 404}

    archived = client.delete(
        f"/api/v1/locations/{location.id}/equipment/{equipment['id']}", headers=owner_headers
    )
    assert archived.status_code == 204
    assert client.get(f"/api/v1/locations/{location.id}/equipment", headers=owner_headers).json() == []
