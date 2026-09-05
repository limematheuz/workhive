"""Task report update / delete / bulk-delete API contracts.

These tests define manager/admin mutation behaviour before implementation.
"""

from app.models.notification import Notification
from tests.test_task_report_center import (
    _accept_external_task,
    _png,
    _report_payload,
)
from tests.test_task_notifications import _external_task, _headers


def _create_report(client, headers, task_id: int, **overrides) -> dict:
    response = client.post(
        "/api/v1/task-reports/",
        headers=headers,
        json=_report_payload(task_id, **overrides),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_manager_can_update_issue_and_note_fields(client, db):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    viewer_headers = _headers(users["receiver_viewer"])
    manager_headers = _headers(users["receiver_manager"])

    issue = _create_report(client, viewer_headers, task.id)
    note = _create_report(
        client,
        viewer_headers,
        task.id,
        report_type="note",
        title=None,
        description="Nota original",
        issue_type=None,
        element=None,
    )

    updated_issue = client.patch(
        f"/api/v1/task-reports/{issue['id']}",
        headers=manager_headers,
        json={
            "title": "Cristal reparado parcialmente",
            "description": "Sigue pendiente el marco",
            "issue_type": "inspeccion",
            "element": "ventana",
        },
    )
    assert updated_issue.status_code == 200, updated_issue.text
    body = updated_issue.json()
    assert body["id"] == issue["id"]
    assert body["title"] == "Cristal reparado parcialmente"
    assert body["description"] == "Sigue pendiente el marco"
    assert body["issue_type"] == "inspeccion"
    assert body["element"] == "ventana"
    assert body["report_type"] == "issue"

    updated_note = client.patch(
        f"/api/v1/task-reports/{note['id']}",
        headers=_headers(users["owner_admin"]),
        json={"description": "Nota corregida"},
    )
    assert updated_note.status_code == 200, updated_note.text
    assert updated_note.json()["description"] == "Nota corregida"
    assert updated_note.json()["report_type"] == "note"


def test_update_checklist_note_syncs_task_evidence(client, db):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    db.refresh(task)
    checklist_item = task.checklist_items[0]
    created = _create_report(
        client,
        _headers(users["receiver_viewer"]),
        task.id,
        report_type="checklist_note",
        title=None,
        description="Nota inicial",
        checklist_item_id=checklist_item.id,
        issue_type=None,
        element=None,
    )

    response = client.patch(
        f"/api/v1/task-reports/{created['id']}",
        headers=_headers(users["receiver_admin"]),
        json={"description": "Nota actualizada"},
    )
    assert response.status_code == 200, response.text
    db.refresh(task)
    assert task.checklist_evidence[f"item_{checklist_item.id}"]["note"] == "Nota actualizada"


def test_update_rejects_invalid_shapes_and_unauthorized_actors(client, db):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    created = _create_report(client, _headers(users["receiver_viewer"]), task.id)

    empty_title = client.patch(
        f"/api/v1/task-reports/{created['id']}",
        headers=_headers(users["receiver_admin"]),
        json={"title": " "},
    )
    assert empty_title.status_code == 422, empty_title.text

    forged_type = client.patch(
        f"/api/v1/task-reports/{created['id']}",
        headers=_headers(users["receiver_admin"]),
        json={"report_type": "note", "title": "No se puede cambiar el tipo"},
    )
    assert forged_type.status_code == 422, forged_type.text

    assert client.patch(
        f"/api/v1/task-reports/{created['id']}",
        headers=_headers(users["receiver_viewer"]),
        json={"title": "Solo managers"},
    ).status_code == 403

    assert client.patch(
        f"/api/v1/task-reports/{created['id']}",
        headers=_headers(users["unrelated_admin"]),
        json={"title": "Otro tenant"},
    ).status_code == 404

    note = _create_report(
        client,
        _headers(users["receiver_viewer"]),
        task.id,
        report_type="note",
        title=None,
        description="Texto",
        issue_type=None,
        element=None,
    )
    assert client.patch(
        f"/api/v1/task-reports/{note['id']}",
        headers=_headers(users["receiver_admin"]),
        json={"description": " "},
    ).status_code == 422


def test_manager_can_delete_report_and_related_notifications(client, db):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    created = _create_report(client, _headers(users["receiver_viewer"]), task.id)
    report_id = created["id"]

    assert db.query(Notification).filter(
        Notification.entity_type == "task_report",
        Notification.entity_id == report_id,
    ).count() >= 1

    deleted = client.delete(
        f"/api/v1/task-reports/{report_id}",
        headers=_headers(users["owner_admin"]),
    )
    assert deleted.status_code == 204, deleted.text

    assert client.get(
        f"/api/v1/task-reports/{report_id}",
        headers=_headers(users["owner_admin"]),
    ).status_code == 404
    assert client.get(
        "/api/v1/task-reports/",
        headers=_headers(users["receiver_admin"]),
    ).json() == []
    assert db.query(Notification).filter(
        Notification.entity_type == "task_report",
        Notification.entity_id == report_id,
    ).count() == 0


def test_delete_checklist_evidence_and_blocks_unauthorized(client, db):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    db.refresh(task)
    checklist_item = task.checklist_items[0]
    evidence_key = f"item_{checklist_item.id}"

    note = _create_report(
        client,
        _headers(users["receiver_viewer"]),
        task.id,
        report_type="checklist_note",
        title=None,
        description="Borrar esta nota",
        checklist_item_id=checklist_item.id,
        issue_type=None,
        element=None,
    )
    uploaded = client.post(
        "/api/v1/uploads/?folder=location",
        headers=_headers(users["receiver_viewer"]),
        files={"file": ("evidence.png", _png(), "image/png")},
    )
    assert uploaded.status_code == 201, uploaded.text
    photo = _create_report(
        client,
        _headers(users["receiver_viewer"]),
        task.id,
        report_type="checklist_photo",
        title=None,
        description=None,
        media_url=uploaded.json()["url"],
        file_name="evidence.png",
        checklist_item_id=checklist_item.id,
        issue_type=None,
        element=None,
    )
    db.refresh(task)
    assert "note" in task.checklist_evidence[evidence_key]
    assert "photoUrl" in task.checklist_evidence[evidence_key]

    assert client.delete(
        f"/api/v1/task-reports/{note['id']}",
        headers=_headers(users["receiver_viewer"]),
    ).status_code == 403
    assert client.delete(
        f"/api/v1/task-reports/{photo['id']}",
        headers=_headers(users["unrelated_admin"]),
    ).status_code == 404

    assert client.delete(
        f"/api/v1/task-reports/{note['id']}",
        headers=_headers(users["receiver_manager"]),
    ).status_code == 204
    db.refresh(task)
    assert "note" not in (task.checklist_evidence.get(evidence_key) or {})
    assert "photoUrl" in task.checklist_evidence[evidence_key]

    assert client.delete(
        f"/api/v1/task-reports/{photo['id']}",
        headers=_headers(users["receiver_admin"]),
    ).status_code == 204
    assert client.get(
        uploaded.json()["url"],
        headers=_headers(users["receiver_admin"]),
    ).status_code == 200
    db.refresh(task)
    assert evidence_key not in (task.checklist_evidence or {}) or task.checklist_evidence[
        evidence_key
    ] == {}


def test_bulk_delete_removes_selected_company_reports_only(client, db):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    viewer_headers = _headers(users["receiver_viewer"])
    first = _create_report(client, viewer_headers, task.id, title="Uno")
    second = _create_report(client, viewer_headers, task.id, title="Dos")
    kept = _create_report(client, viewer_headers, task.id, title="Tres")

    empty = client.post(
        "/api/v1/task-reports/bulk-delete",
        headers=_headers(users["receiver_admin"]),
        json={"ids": []},
    )
    assert empty.status_code == 422, empty.text

    missing = client.post(
        "/api/v1/task-reports/bulk-delete",
        headers=_headers(users["receiver_admin"]),
        json={"ids": [first["id"], 9_999_999]},
    )
    assert missing.status_code == 404, missing.text
    assert client.get(
        f"/api/v1/task-reports/{first['id']}",
        headers=_headers(users["receiver_admin"]),
    ).status_code == 200

    assert client.post(
        "/api/v1/task-reports/bulk-delete",
        headers=_headers(users["receiver_viewer"]),
        json={"ids": [first["id"], second["id"]]},
    ).status_code == 403

    deleted = client.post(
        "/api/v1/task-reports/bulk-delete",
        headers=_headers(users["receiver_admin"]),
        json={"ids": [first["id"], second["id"]]},
    )
    assert deleted.status_code == 204, deleted.text

    listed = client.get(
        "/api/v1/task-reports/",
        headers=_headers(users["owner_admin"]),
    )
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [kept["id"]]
