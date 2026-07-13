from io import BytesIO

from PIL import Image
from app.services.image_service import MAX_IMAGE_BYTES
from credentials import TEST_SECRET, login_form, CREDENTIAL_FIELD



def _png() -> bytes:
    output = BytesIO()
    Image.new("RGB", (8, 8), color="blue").save(output, format="PNG")
    return output.getvalue()


def _company_headers(client, suffix: str) -> dict[str, str]:
    email = f"media-{suffix}@workhive.com"
    password = TEST_SECRET
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            CREDENTIAL_FIELD: password,
            "full_name": f"Media {suffix}",
            "accept_terms": True,
            "accept_privacy": True,
            "policy_version": "2026-06-15",
        },
    )
    assert registered.status_code == 201, registered.text
    login = client.post(
        "/api/v1/auth/login",
        data=login_form(email, password),
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    company = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": f"Media Company {suffix}",
            "tax_id": f"MEDIA-{suffix}",
            "address": "Media Street 1",
            "phone": "600000002",
            "email": email,
        },
    )
    assert company.status_code == 201, company.text
    return headers


def test_uploaded_media_is_private_to_the_company(client):
    owner_headers = _company_headers(client, "owner")
    other_headers = _company_headers(client, "other")

    uploaded = client.post(
        "/api/v1/uploads/?folder=company",
        headers=owner_headers,
        files={"file": ("logo.png", _png(), "image/png")},
    )
    assert uploaded.status_code == 201, uploaded.text
    url = uploaded.json()["url"]
    assert not url.startswith("data:")

    owner_read = client.get(url, headers=owner_headers)
    assert owner_read.status_code == 200
    assert owner_read.content == _png()
    assert owner_read.headers["content-type"] == "image/png"

    cross_company_read = client.get(url, headers=other_headers)
    assert cross_company_read.status_code == 404


def test_upload_rejects_payloads_over_the_image_limit(client):
    headers = _company_headers(client, "oversized")
    response = client.post(
        "/api/v1/uploads/?folder=general",
        headers=headers,
        files={
            "file": (
                "oversized.png",
                b"\x89PNG\r\n\x1a\n" + b"x" * MAX_IMAGE_BYTES,
                "image/png",
            )
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Image must be 4MB or smaller"
