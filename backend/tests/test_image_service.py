from io import BytesIO

import pytest
from fastapi import HTTPException
from PIL import Image

from app.core.config import settings
from app.services import image_service


def _png(width: int = 8, height: int = 8) -> bytes:
    output = BytesIO()
    Image.new("RGB", (width, height), color="blue").save(output, format="PNG")
    return output.getvalue()


def test_valid_image_is_encoded():
    encoded = image_service.encode_image_as_data_url(_png())
    assert encoded.startswith("data:image/png;base64,")


def test_valid_image_is_stored_outside_the_database(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "MEDIA_STORAGE_PATH", str(tmp_path))
    url = image_service.store_image(_png(), company_id=7, folder="profile")

    assert url.startswith("/api/v1/uploads/media/company/7/profile/")
    key = url.removeprefix("/api/v1/uploads/media/")
    stored = image_service.get_object_storage().get(key)
    assert stored.contents == _png()
    assert stored.content_type == "image/png"


def test_data_url_migration_is_idempotent(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "MEDIA_STORAGE_PATH", str(tmp_path))
    legacy = image_service.encode_image_as_data_url(_png())

    migrated = image_service.store_image_data_url(
        legacy,
        company_id=3,
        folder="company",
    )

    assert (
        image_service.store_image_data_url(
            migrated,
            company_id=3,
            folder="company",
        )
        == migrated
    )


def test_corrupted_image_with_valid_header_is_rejected():
    with pytest.raises(HTTPException) as error:
        image_service.encode_image_as_data_url(b"\x89PNG\r\n\x1a\ncorrupted")
    assert error.value.status_code == 400
    assert "invalid or corrupted" in error.value.detail


def test_image_dimensions_are_limited(monkeypatch):
    monkeypatch.setattr(image_service, "MAX_IMAGE_WIDTH", 4)
    with pytest.raises(HTTPException) as error:
        image_service.encode_image_as_data_url(_png(width=8))
    assert error.value.status_code == 400
    assert "dimensions" in error.value.detail
