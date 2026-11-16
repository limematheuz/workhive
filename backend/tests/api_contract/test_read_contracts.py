from io import BytesIO

from PIL import Image


def test_authorized_read_routes_resolve_real_workspace_records(client, api_workspace):
    qa = api_workspace
    assignment = f"/api/v1/clients/{qa.client.id}/account-assignment"
    candidates = client.get(assignment + "/candidates", headers=qa.headers["admin"])
    assert candidates.status_code == 200 and candidates.json(), candidates.text
    assigned = client.put(
        assignment,
        headers=qa.headers["admin"],
        json={"membership_id": candidates.json()[0]["membership_id"]},
    )
    assert assigned.status_code == 200, assigned.text
    paths = [
        f"/api/v1/users/{qa.worker.id}",
        f"/api/v1/clients/{qa.client.id}/account-assignment",
        f"/api/v1/companies/{qa.company.id}/expenses",
        "/api/v1/work-orders/",
        "/api/v1/bank-reconciliation/entries",
        "/api/v1/fiscal-settings/",
        "/api/v1/privacy/requests/me",
    ]
    for path in paths:
        response = client.get(path, headers=qa.headers["admin"])
        assert response.status_code == 200, (path, response.text)
    validated = client.post(
        "/api/v1/fiscal-settings/validate", headers=qa.headers["admin"]
    )
    assert validated.status_code == 200, validated.text
    assert (
        client.post(
            "/api/v1/fiscal-settings/validate", headers=qa.headers["worker"]
        ).status_code
        == 403
    )
    assert (
        client.get(
            "/api/v1/trial-requests/", headers=qa.headers["platform"]
        ).status_code
        == 200
    )


def test_photo_upload_preserves_ownership_and_media_read_authorization(
    client, api_workspace
):
    qa = api_workspace
    image = BytesIO()
    Image.new("RGB", (16, 16), color="blue").save(image, format="PNG")
    data = image.getvalue()
    path = f"/api/v1/users/{qa.worker.id}/photo"
    forbidden = client.post(
        path,
        headers=qa.headers["outsider"],
        files={"file": ("qa.png", data, "image/png")},
    )
    assert forbidden.status_code in {403, 404}, forbidden.text
    invalid = client.post(
        path,
        headers=qa.headers["worker"],
        files={"file": ("qa.png", b"invalid", "image/png")},
    )
    assert invalid.status_code == 400, invalid.text
    uploaded = client.post(
        path,
        headers=qa.headers["worker"],
        files={"file": ("qa.png", data, "image/png")},
    )
    assert uploaded.status_code == 200, uploaded.text
    url = uploaded.json()["photo_url"]
    media = client.get(url, headers=qa.headers["worker"])
    assert media.status_code == 200 and media.headers["content-type"].startswith(
        "image/"
    ), media.text
    assert client.get(url, headers=qa.headers["outsider"]).status_code in {403, 404}


def test_unused_location_can_be_archived_only_by_its_owner(client, api_workspace):
    qa = api_workspace
    created = client.post(
        "/api/v1/locations/",
        headers=qa.headers["admin"],
        json={"name": "Disposable QA site", "address": "Calle QA", "city": "Madrid"},
    )
    assert created.status_code == 201, created.text
    path = f"/api/v1/locations/{created.json()['id']}"
    assert client.delete(path, headers=qa.headers["outsider"]).status_code in {403, 404}
    deleted = client.delete(path, headers=qa.headers["admin"])
    assert deleted.status_code == 200 and deleted.json()["is_active"] is False, (
        deleted.text
    )
