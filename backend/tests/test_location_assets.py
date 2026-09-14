from io import BytesIO

from PIL import Image

from app.models.location import Location
from app.models.location_document import LocationDocument
from app.services.image_service import MAX_IMAGE_BYTES
from tests.test_location_workspace import _admin, _company, _headers


PDF = b"%PDF-1.4\nlocation document\n%%EOF"


def _webp() -> bytes:
    output = BytesIO()
    Image.new("RGB", (8, 8), color="blue").save(output, format="WEBP")
    return output.getvalue()


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


def test_location_documents_are_private_validated_and_archived(client, db):
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

    archived = client.delete(
        f"/api/v1/locations/{location.id}/documents/{document['id']}", headers=owner_headers
    )
    assert archived.status_code == 204
    assert client.get(f"/api/v1/locations/{location.id}/documents", headers=owner_headers).json() == []
    assert client.get(
        f"/api/v1/locations/{location.id}/documents/{document['id']}/download", headers=owner_headers
    ).status_code == 404


def test_location_document_storage_uses_the_company_plan(client, db):
    mebibyte = 1024 * 1024
    basic_company = _company(db, "BasicAssets")
    basic_company.subscription_plan = "basic"
    db.commit()
    basic_admin = _admin(db, basic_company)
    basic_location = _location(db, basic_company)

    too_large = b"%PDF-" + b"0" * mebibyte
    rejected = client.post(
        f"/api/v1/locations/{basic_location.id}/documents",
        headers=_headers(basic_admin),
        files={"file": ("demasiado-grande.pdf", too_large, "application/pdf")},
    )
    assert rejected.status_code == 413
    assert rejected.headers["x-workhive-error-code"] == "entitlement.quota_reached"

    db.add(
        LocationDocument(
            company_id=basic_company.id,
            location_id=basic_location.id,
            name="limite.pdf",
            document_type="other",
            storage_key="tests/basic-storage-limit.pdf",
            content_type="application/pdf",
            size_bytes=mebibyte,
            sha256="0" * 64,
            created_by_user_id=basic_admin.id,
        )
    )
    db.commit()
    quota_reached = client.post(
        f"/api/v1/locations/{basic_location.id}/documents",
        headers=_headers(basic_admin),
        files={"file": ("otro.pdf", PDF, "application/pdf")},
    )
    assert quota_reached.status_code == 409
    assert quota_reached.headers["x-workhive-error-code"] == "entitlement.quota_reached"

    top_company = _company(db, "TopAssets")
    top_company.subscription_plan = "top"
    db.commit()
    top_admin = _admin(db, top_company)
    top_location = _location(db, top_company)
    allowed = b"%PDF-" + b"0" * mebibyte
    uploaded = client.post(
        f"/api/v1/locations/{top_location.id}/documents",
        headers=_headers(top_admin),
        files={"file": ("ampliado.pdf", allowed, "application/pdf")},
    )
    assert uploaded.status_code == 201, uploaded.text


def test_location_document_rejects_images_over_one_megabyte(client, db):
    company = _company(db, "TopImageAssets")
    company.subscription_plan = "top"
    db.commit()
    admin = _admin(db, company)
    location = _location(db, company)

    response = client.post(
        f"/api/v1/locations/{location.id}/documents",
        headers=_headers(admin),
        files={
            "file": (
                "foto-demasiado-grande.jpg",
                b"\xff\xd8\xff" + b"x" * MAX_IMAGE_BYTES,
                "image/jpeg",
            )
        },
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "La imagen no puede superar 1 MB"


def test_location_document_accepts_valid_webp_images(client, db):
    company = _company(db, "TopWebpAssets")
    company.subscription_plan = "top"
    db.commit()
    admin = _admin(db, company)
    location = _location(db, company)

    response = client.post(
        f"/api/v1/locations/{location.id}/documents",
        headers=_headers(admin),
        files={"file": ("foto.webp", _webp(), "image/webp")},
    )

    assert response.status_code == 201, response.text
    assert response.json()["content_type"] == "image/webp"


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
