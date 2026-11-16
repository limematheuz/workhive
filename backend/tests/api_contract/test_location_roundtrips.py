def test_spaces_and_explicit_company_access_can_be_revoked(client, api_workspace):
    qa = api_workspace
    headers = qa.headers["admin"]
    base = f"/api/v1/locations/{qa.location.id}"
    outsider = qa.headers["outsider"]
    assert client.get(base, headers=outsider).status_code in {403, 404}
    spaces = base + "/spaces"
    created = client.post(spaces, headers=headers, json={"name": "Kitchen"})
    assert created.status_code == 201, created.text
    space = f"{spaces}/{created.json()['id']}"
    assert client.patch(
        space, headers=outsider, json={"name": "Intrusion"}
    ).status_code in {403, 404}
    updated = client.patch(space, headers=headers, json={"name": "Kitchen QA"})
    assert updated.status_code == 200 and updated.json()["name"] == "Kitchen QA", (
        updated.text
    )
    invalid = client.post(
        space + "/tasks",
        headers=headers,
        json={"title": "Check", "estimated_minutes": 0},
    )
    assert invalid.status_code == 422
    task = client.post(
        space + "/tasks",
        headers=headers,
        json={"title": "Clean floor", "estimated_minutes": 10},
    )
    assert task.status_code == 201, task.text
    assert client.delete(space, headers=outsider).status_code in {403, 404}
    assert client.delete(space, headers=headers).status_code == 204
    for suffix in ["users", "service-providers", "company-access"]:
        response = client.get(f"{base}/{suffix}", headers=headers)
        assert response.status_code == 200, response.text
    access = base + "/company-access"
    granted = client.post(access, headers=headers, json={"company_id": qa.other.id})
    assert granted.status_code == 201, granted.text
    assert client.get(base, headers=outsider).status_code == 200
    assert client.post(
        spaces, headers=outsider, json={"name": "Intrusion"}
    ).status_code in {403, 404}
    resource = f"{access}/{qa.other.id}"
    changed = client.patch(resource, headers=headers, json={"can_manage_tasks": True})
    assert changed.status_code == 200 and changed.json()["can_manage_tasks"] is True, (
        changed.text
    )
    assert client.delete(resource, headers=headers).status_code == 204
    assert client.get(base, headers=outsider).status_code in {403, 404}


def test_global_roles_stay_frozen_for_platform_admins(client, api_workspace):
    qa = api_workspace
    assert client.get("/api/v1/roles/", headers=qa.headers["admin"]).status_code == 200
    assert client.get("/api/v1/roles/1", headers=qa.headers["admin"]).status_code == 200
    for method, path in [("post", "/api/v1/roles/"), ("patch", "/api/v1/roles/1")]:
        operation = getattr(client, method)
        assert (
            operation(
                path, headers=qa.headers["admin"], json={"name": "forbidden"}
            ).status_code
            == 403
        )
        frozen = operation(
            path, headers=qa.headers["platform"], json={"name": "forbidden"}
        )
        assert frozen.status_code == 409, frozen.text
    assert (
        client.get("/api/v1/roles/1", headers=qa.headers["admin"]).json()["name"]
        == "admin"
    )
