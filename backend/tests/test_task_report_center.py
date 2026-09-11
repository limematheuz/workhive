from io import BytesIO
from uuid import uuid4

from PIL import Image

from app.models.notification import Notification
from app.models.task_item import TaskItem
from app.models.task_structure import TaskChecklistAssignment, TaskChecklistItem
from tests.test_task_notifications import _external_task, _headers


def _accept_external_task(client, db, users) -> TaskItem:
    task = users["task"]
    response = client.post(
        f"/api/v1/task-items/{task.id}/accept",
        headers=_headers(users["receiver_admin"]),
        json={},
    )
    assert response.status_code == 200, response.text
    if not task.checklist_items:
        checklist_item = TaskChecklistItem(
            task_id=task.id,
            position=1,
            text="Revisar cama",
            completed=False,
        )
        db.add(checklist_item)
        db.flush()
        db.add(
            TaskChecklistAssignment(
                checklist_item_id=checklist_item.id,
                user_id=users["receiver_viewer"].id,
                status="accepted",
            )
        )
        db.commit()
        db.refresh(task)
    return task


def _report_payload(task_id: int, **overrides):
    payload = {
        "task_item_id": task_id,
        "client_event_id": str(uuid4()),
        "report_type": "issue",
        "title": "Cristal roto",
        "description": "Ventana del dormitorio dañada",
        "issue_type": "mantenimiento",
        "element": "ventana",
    }
    payload.update(overrides)
    return payload


def _png() -> bytes:
    output = BytesIO()
    Image.new("RGB", (8, 8), color="blue").save(output, format="PNG")
    return output.getvalue()


def test_report_history_is_normalized_visible_to_both_companies_and_not_in_task_json(
    client,
    db,
):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)

    created = client.post(
        "/api/v1/task-reports/",
        headers=_headers(users["receiver_viewer"]),
        json=_report_payload(task.id),
    )
    assert created.status_code == 201, created.text
    payload = created.json()
    assert payload["task_item_id"] == task.id
    assert payload["report_type"] == "issue"
    assert payload["reporter_user_id"] == users["receiver_viewer"].id
    assert payload["reporter_company_id"] == users["receiver_viewer"].company_id
    assert payload["requesting_company_id"] == users["owner_admin"].company_id
    assert payload["task_title"] == task.title
    assert payload["location_name"] == "Casa Notificaciones"

    stored_task = db.get(TaskItem, task.id)
    assert stored_task.reported_issues == []
    assert stored_task.operational_notes == []
    assert stored_task.attachments == []

    for user_key in (
        "owner_admin",
        "owner_emitter",
        "receiver_admin",
        "second_receiver_admin",
        "receiver_manager",
    ):
        listed = client.get(
            "/api/v1/task-reports/",
            headers=_headers(users[user_key]),
        )
        assert listed.status_code == 200, (user_key, listed.text)
        assert [item["id"] for item in listed.json()] == [payload["id"]]

    viewer_history = client.get(
        "/api/v1/task-reports/",
        headers=_headers(users["receiver_viewer"]),
    )
    assert viewer_history.status_code == 200, viewer_history.text
    assert [item["id"] for item in viewer_history.json()] == [payload["id"]]
    assert client.get(
        "/api/v1/task-reports/",
        headers=_headers(users["unrelated_admin"]),
    ).json() == []
    assert client.get(
        f"/api/v1/task-reports/{payload['id']}",
        headers=_headers(users["unrelated_admin"]),
    ).status_code == 404

    notifications = db.query(Notification).filter(
        Notification.event_type == "task.reported"
    ).all()
    assert {item.user_id for item in notifications} == {
        users["owner_admin"].id,
        users["owner_emitter"].id,
        users["receiver_admin"].id,
        users["second_receiver_admin"].id,
    }
    assert all(item.entity_type == "task_report" for item in notifications)
    assert all(item.entity_id == payload["id"] for item in notifications)
    assert all(item.href == f"/dashboard/task-reports?reportId={payload['id']}" for item in notifications)
    assert "Ventana del dormitorio" not in str([item.metadata_json for item in notifications])


def test_report_creation_is_idempotent_and_rejects_forged_or_unbounded_payloads(
    client,
    db,
):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    payload = _report_payload(
        task.id,
        report_type="note",
        title=None,
        description="Dejar constancia",
        issue_type=None,
        element=None,
    )

    first = client.post(
        "/api/v1/task-reports/",
        headers=_headers(users["receiver_viewer"]),
        json=payload,
    )
    second = client.post(
        "/api/v1/task-reports/",
        headers=_headers(users["receiver_viewer"]),
        json=payload,
    )
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert second.json()["id"] == first.json()["id"]
    assert db.query(Notification).filter(
        Notification.event_type == "task.reported"
    ).count() == 4

    invalid_payloads = (
        _report_payload(task.id, report_type="unknown"),
        _report_payload(task.id, title=" "),
        _report_payload(
            task.id,
            report_type="note",
            title=None,
            description=" ",
            issue_type=None,
            element=None,
        ),
        _report_payload(
            task.id,
            report_type="photo",
            title=None,
            description=None,
            media_url="https://attacker.example/tracking.png",
            issue_type=None,
            element=None,
        ),
        _report_payload(task.id, description="x" * 4001),
        {**_report_payload(task.id), "reporter_company_id": users["owner_admin"].company_id},
        _report_payload(
            task.id,
            report_type="checklist_note",
            title=None,
            description="Nota sin requisito",
            issue_type=None,
            element=None,
        ),
    )
    for invalid in invalid_payloads:
        response = client.post(
            "/api/v1/task-reports/",
            headers=_headers(users["receiver_viewer"]),
            json=invalid,
        )
        assert response.status_code == 422, response.text

    cross_tenant = client.post(
        "/api/v1/task-reports/",
        headers=_headers(users["unrelated_admin"]),
        json=_report_payload(task.id),
    )
    assert cross_tenant.status_code == 404
    assert client.post(
        "/api/v1/task-reports/",
        headers=_headers(users["owner_admin"]),
        json=_report_payload(task.id),
    ).status_code == 404
    assert client.patch(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(users["receiver_admin"]),
        json={"reported_issues": [{"title": "Borrado o falsificado"}]},
    ).status_code == 403


def test_checklist_notes_and_photos_are_atomic_and_media_is_cross_tenant_authorized(
    client,
    db,
):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    db.refresh(task)
    checklist_item = task.checklist_items[0]

    note = client.post(
        "/api/v1/task-reports/",
        headers=_headers(users["receiver_viewer"]),
        json=_report_payload(
            task.id,
            report_type="checklist_note",
            title=None,
            description="La cama está rota",
            checklist_item_id=checklist_item.id,
            issue_type=None,
            element=None,
        ),
    )
    assert note.status_code == 201, note.text
    db.refresh(task)
    assert task.checklist_evidence[f"item_{checklist_item.id}"]["note"] == "La cama está rota"
    assert note.json()["checklist_item_label"] == checklist_item.text

    uploaded = client.post(
        "/api/v1/uploads/?folder=location",
        headers=_headers(users["receiver_viewer"]),
        files={"file": ("evidence.png", _png(), "image/png")},
    )
    assert uploaded.status_code == 201, uploaded.text
    raw_media_url = uploaded.json()["url"]
    photo = client.post(
        "/api/v1/task-reports/",
        headers=_headers(users["receiver_viewer"]),
        json=_report_payload(
            task.id,
            report_type="checklist_photo",
            title=None,
            description=None,
            media_url=raw_media_url,
            file_name="evidence.png",
            checklist_item_id=checklist_item.id,
            issue_type=None,
            element=None,
        ),
    )
    assert photo.status_code == 201, photo.text
    report_id = photo.json()["id"]
    assert photo.json()["media_url"] == f"/api/v1/task-reports/{report_id}/media"
    db.refresh(task)
    assert task.checklist_evidence[f"item_{checklist_item.id}"]["photoUrl"] == raw_media_url

    # Raw media remains tenant-private. The report endpoint grants only report participants access.
    assert client.get(
        raw_media_url,
        headers=_headers(users["owner_admin"]),
    ).status_code == 404
    allowed_media = client.get(
        f"/api/v1/task-reports/{report_id}/media",
        headers=_headers(users["owner_admin"]),
    )
    assert allowed_media.status_code == 200
    assert allowed_media.headers["content-type"] == "image/png"
    assert client.get(
        f"/api/v1/task-reports/{report_id}/media",
        headers=_headers(users["unrelated_admin"]),
    ).status_code == 404


def test_viewing_report_center_clears_only_current_users_report_notifications(
    client,
    db,
):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    created = client.post(
        "/api/v1/task-reports/",
        headers=_headers(users["receiver_viewer"]),
        json=_report_payload(task.id),
    )
    assert created.status_code == 201, created.text

    assignment = Notification(
        user_id=users["owner_admin"].id,
        company_id=users["owner_admin"].company_id,
        event_type="task.assigned",
        title="Otra notificación",
        message="Debe permanecer",
        entity_type="task_item",
        entity_id=task.id,
        href="/dashboard/tasks",
        metadata_json={},
    )
    db.add(assignment)
    db.commit()

    before = client.get(
        "/api/v1/notifications/?unread_only=true&limit=200",
        headers=_headers(users["owner_admin"]),
    )
    assert before.status_code == 200
    assert any(item["event_type"] == "task.reported" for item in before.json())
    unrelated_notification_ids = {
        item["id"]
        for item in before.json()
        if item["event_type"] != "task.reported"
    }

    response = client.patch(
        "/api/v1/task-reports/notifications/read",
        headers=_headers(users["owner_admin"]),
    )
    assert response.status_code == 204, response.text
    remaining = client.get(
        "/api/v1/notifications/?unread_only=true&limit=200",
        headers=_headers(users["owner_admin"]),
    )
    assert remaining.status_code == 200
    assert {item["id"] for item in remaining.json()} == unrelated_notification_ids

    other_admin = client.get(
        "/api/v1/notifications/?unread_only=true&limit=200",
        headers=_headers(users["second_receiver_admin"]),
    )
    assert any(item["event_type"] == "task.reported" for item in other_admin.json())
