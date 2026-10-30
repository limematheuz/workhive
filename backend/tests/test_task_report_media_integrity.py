from pathlib import Path

from app.core.config import settings
from app.models.notification import Notification
from app.models.task_report import TaskReport
from tests.test_task_notifications import _external_task, _headers
from tests.test_task_report_center import _accept_external_task, _png, _report_payload


def _upload(client, headers):
    response = client.post(
        "/api/v1/uploads/?folder=location",
        headers=headers,
        files={"file": ("evidence.png", _png(), "image/png")},
    )
    assert response.status_code == 201, response.text
    return response.json()["url"]


def test_invalid_checklist_photo_does_not_copy_media_or_change_history(client, db):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    headers = _headers(users["receiver_viewer"])
    uploaded = _upload(client, headers)
    root = Path(settings.MEDIA_STORAGE_PATH)
    files_before = {
        path: path.read_bytes() for path in root.rglob("*") if path.is_file()
    }
    reports_before = db.query(TaskReport).count()
    notifications_before = db.query(Notification).count()
    evidence_before = dict(task.checklist_evidence or {})

    response = client.post(
        "/api/v1/task-reports/",
        headers=headers,
        json=_report_payload(
            task.id,
            report_type="checklist_photo",
            media_url=uploaded,
            file_name="evidence.png",
            checklist_item_id=9_999_999,
        ),
    )

    assert response.status_code == 422, response.text
    assert response.json()["detail"] == "Checklist item does not belong to this task"
    assert {
        path: path.read_bytes() for path in root.rglob("*") if path.is_file()
    } == files_before
    assert db.query(TaskReport).count() == reports_before
    assert db.query(Notification).count() == notifications_before
    db.refresh(task)
    assert (task.checklist_evidence or {}) == evidence_before


def test_photo_reports_own_independent_copies_and_preserve_the_upload(client, db):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    headers = _headers(users["receiver_viewer"])
    uploaded = _upload(client, headers)
    original = client.get(uploaded, headers=headers)
    assert original.status_code == 200
    reports = []
    for _ in range(2):
        created = client.post(
            "/api/v1/task-reports/",
            headers=headers,
            json=_report_payload(task.id, report_type="photo", media_url=uploaded),
        )
        assert created.status_code == 201, created.text
        reports.append(created.json())
    assert reports[0]["media_url"] != reports[1]["media_url"]
    keys = [db.get(TaskReport, report["id"]).media_key for report in reports]
    assert keys[0] != keys[1]

    for report in reports:
        for role in ("receiver_viewer", "receiver_admin", "owner_admin"):
            downloaded = client.get(report["media_url"], headers=_headers(users[role]))
            assert downloaded.status_code == 200
            assert downloaded.content == original.content
            assert downloaded.headers["content-type"] == "image/png"
        assert (
            client.get(
                report["media_url"], headers=_headers(users["unrelated_admin"])
            ).status_code
            == 404
        )
    assert (
        client.delete(
            f"/api/v1/task-reports/{reports[0]['id']}", headers=headers
        ).status_code
        == 403
    )
    deleted = client.delete(
        f"/api/v1/task-reports/{reports[0]['id']}",
        headers=_headers(users["receiver_admin"]),
    )
    assert deleted.status_code == 204, deleted.text
    root = Path(settings.MEDIA_STORAGE_PATH)
    assert not (root / keys[0]).exists()
    assert (root / keys[1]).exists()
    assert client.get(reports[0]["media_url"], headers=headers).status_code == 404
    assert (
        client.get(reports[1]["media_url"], headers=headers).content == original.content
    )
    assert client.get(uploaded, headers=headers).content == original.content
