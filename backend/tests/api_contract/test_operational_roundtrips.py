from app.models.work_session import WorkSession


def test_shift_endpoints_persist_pause_resume_summaries_and_denials(
    client, db, api_workspace
):
    qa = api_workspace
    worker = qa.headers["worker"]
    payload = {
        "location_id": qa.location.id,
        "task_item_id": qa.task.id,
        "start_latitude": 0,
        "start_longitude": 0,
        "start_accuracy_meters": 5,
    }
    denied = client.post(
        "/api/v1/work-sessions/start", headers=qa.headers["outsider"], json=payload
    )
    assert denied.status_code in {403, 404}, denied.text
    invalid = client.post(
        "/api/v1/work-sessions/start",
        headers=worker,
        json={**payload, "start_latitude": 91},
    )
    assert invalid.status_code == 422
    assert db.query(WorkSession).count() == 0
    started = client.post("/api/v1/work-sessions/start", headers=worker, json=payload)
    assert started.status_code == 201, started.text
    session_id = started.json()["id"]
    assert (
        client.get("/api/v1/work-sessions/active", headers=worker).json()["id"]
        == session_id
    )
    live = client.get(
        "/api/v1/work-sessions/company/active", headers=qa.headers["admin"]
    )
    assert live.status_code == 200, live.text
    assert any(row["id"] == session_id for row in live.json())
    for suffix in ["summary", "detailed-summary"]:
        response = client.get(
            f"/api/v1/work-sessions/task/{qa.task.id}/{suffix}", headers=worker
        )
        assert response.status_code == 200, response.text
    batch = client.get(
        "/api/v1/work-sessions/tasks/detailed-summaries",
        headers=worker,
        params={"task_item_ids": [qa.task.id]},
    )
    assert batch.status_code == 200, batch.text
    paused = client.post("/api/v1/work-sessions/pause", headers=worker)
    assert paused.status_code == 200 and paused.json()["paused_at"] is not None, (
        paused.text
    )
    assert client.post("/api/v1/work-sessions/pause", headers=worker).status_code == 409
    resumed = client.post("/api/v1/work-sessions/resume", headers=worker)
    assert resumed.status_code == 200 and resumed.json()["paused_at"] is None, (
        resumed.text
    )
    assert (
        client.post(
            "/api/v1/work-sessions/stop", headers=worker, json={"end_latitude": 1}
        ).status_code
        == 422
    )
    assert (
        client.get("/api/v1/work-sessions/active", headers=worker).json()["id"]
        == session_id
    )
    stopped = client.post(
        "/api/v1/work-sessions/stop",
        headers=worker,
        json={"end_latitude": 0, "end_longitude": 0, "end_accuracy_meters": 7},
    )
    assert stopped.status_code == 200 and stopped.json()["end_time"], stopped.text
    assert client.get("/api/v1/work-sessions/active", headers=worker).json() is None
    assert stopped.json()["end_latitude"] == 0
    assert (
        client.post("/api/v1/work-sessions/resume", headers=worker).status_code == 404
    )


def test_service_catalog_and_location_overrides_roundtrip(client, db, api_workspace):
    qa = api_workspace
    headers = qa.headers["admin"]
    created = client.post(
        "/api/v1/template-tasks/",
        headers=headers,
        json={
            "name": "API catalog",
            "description": "- [ ] Check",
            "unit": "service",
            "default_price": 10,
        },
    )
    assert created.status_code == 201, created.text
    service_id = created.json()["id"]
    assert client.get("/api/v1/template-tasks/", headers=headers).status_code == 200
    assert (
        client.get(f"/api/v1/template-tasks/{service_id}", headers=headers).status_code
        == 200
    )
    assert client.get(
        f"/api/v1/template-tasks/{service_id}", headers=qa.headers["outsider"]
    ).status_code in {403, 404}
    assert (
        client.patch(
            f"/api/v1/template-tasks/{service_id}",
            headers=headers,
            json={"default_price": 12},
        ).status_code
        == 200
    )
    versions = client.get(
        f"/api/v1/template-tasks/{service_id}/versions", headers=headers
    )
    assert versions.status_code == 200 and len(versions.json()) == 2, versions.text
    path = f"/api/v1/locations/{qa.location.id}/templates"
    linked = client.post(
        path, headers=headers, json={"template_task_id": service_id, "custom_price": 11}
    )
    assert linked.status_code == 201, linked.text
    assert client.get(path, headers=headers).status_code == 200
    detail = client.get(f"{path}/{service_id}", headers=headers)
    assert (
        detail.status_code == 200 and detail.json()["template_task_id"] == service_id
    ), detail.text
    changed = client.patch(
        f"{path}/{service_id}", headers=headers, json={"custom_price": 13}
    )
    assert changed.status_code == 200 and changed.json()["custom_price"] == 13, (
        changed.text
    )
    assert client.delete(f"{path}/{service_id}", headers=headers).status_code == 204
    assert (
        client.delete(
            f"/api/v1/template-tasks/{service_id}", headers=headers
        ).status_code
        == 204
    )
