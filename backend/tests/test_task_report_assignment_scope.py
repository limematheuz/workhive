from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import event

from app.models.task_item import TaskItem
from app.models.task_report import TaskReport
from app.models.task_structure import TaskAssignment
from app.services.storage_service import StoredObject
from tests.test_task_security_delivery import _company, _headers, _location, _user


def _workspace(db):
    company = _company(db, "ReportAssignments")
    foreign = _company(db, "ForeignReportAssignments")
    users = {
        "worker": _user(db, company, "worker@report-assigned.test", 3),
        "other": _user(db, company, "other@report-assigned.test", 3),
        "admin": _user(db, company, "admin@report-assigned.test", 1),
        "manager": _user(db, company, "manager@report-assigned.test", 2),
        "foreign": _user(db, foreign, "admin@foreign-report-assigned.test", 1),
    }
    location = _location(db, company)
    foreign_location = _location(db, foreign)
    reports = {}
    for index, key in enumerate(
        ["direct", "structured", "reassigned", "unassigned", "foreign"]
    ):
        task = TaskItem(
            title=key,
            unit="servicio",
            company_id=foreign.id if key == "foreign" else company.id,
            location_id=foreign_location.id if key == "foreign" else location.id,
            user_id=users["other"].id
            if key == "structured"
            else users["worker"].id
            if key in {"direct", "reassigned"}
            else None,
            status="accepted",
        )
        db.add(task)
        db.flush()
        if key in {"structured", "reassigned"}:
            db.add(
                TaskAssignment(
                    task_id=task.id,
                    user_id=users["worker" if key == "structured" else "other"].id,
                    status="accepted",
                    source="all",
                )
            )
        report = TaskReport(
            task_item_id=task.id,
            reporter_user_id=users["worker"].id,
            reporter_company_id=task.company_id,
            client_event_id=str(uuid4()),
            report_type="note",
            description=f"Private {key}",
            reporter_name="QA",
            created_at=datetime.now(timezone.utc) + timedelta(seconds=index),
        )
        db.add(report)
        db.flush()
        reports[key] = report
    db.commit()
    return users, reports, foreign


@pytest.mark.parametrize(
    "actor,expected",
    [
        ("worker", ["structured", "direct"]),
        ("other", ["reassigned"]),
        ("admin", ["unassigned", "reassigned", "structured", "direct"]),
        ("manager", ["unassigned", "reassigned", "structured", "direct"]),
        ("foreign", ["foreign"]),
    ],
)
def test_report_history_requires_current_assignment_for_workers(
    client, db, actor, expected
):
    users, reports, _ = _workspace(db)
    response = client.get("/api/v1/task-reports/", headers=_headers(users[actor]))
    assert response.status_code == 200, response.text
    assert [item["id"] for item in response.json()] == [
        reports[key].id for key in expected
    ]


@pytest.mark.parametrize(
    "key,expected",
    [
        ("direct", 200),
        ("structured", 200),
        ("reassigned", 404),
        ("unassigned", 404),
        ("foreign", 404),
    ],
)
def test_report_detail_and_media_share_the_assignment_boundary(
    client, db, monkeypatch, key, expected
):
    users, reports, _ = _workspace(db)
    report = reports[key]
    report.media_key = f"qa-report-{report.id}"
    report.report_type = "photo"
    db.commit()
    reads = []

    class Storage:
        def get(self, media_key):
            reads.append(media_key)
            return StoredObject(contents=b"QA", content_type="image/png")

    monkeypatch.setattr(
        "app.services.task_report_service.get_object_storage", lambda: Storage()
    )
    headers = _headers(users["worker"])
    detail = client.get(f"/api/v1/task-reports/{report.id}", headers=headers)
    media = client.get(f"/api/v1/task-reports/{report.id}/media", headers=headers)
    assert detail.status_code == media.status_code == expected
    assert reads == ([report.media_key] if expected == 200 else [])
    if expected == 200:
        assert media.headers["cache-control"] == "private, no-store"


def test_assignment_filter_runs_before_report_pagination(client, db):
    users, reports, _ = _workspace(db)
    headers = _headers(users["worker"])
    for skip, expected in [
        (0, [reports["structured"].id]),
        (1, [reports["direct"].id]),
        (2, []),
    ]:
        response = client.get(
            f"/api/v1/task-reports/?skip={skip}&limit=1", headers=headers
        )
        assert response.status_code == 200
        assert [item["id"] for item in response.json()] == expected


@pytest.mark.parametrize(
    "key,move_company", [("reassigned", False), ("unassigned", False), ("direct", True)]
)
def test_idempotent_report_replay_does_not_bypass_current_access(
    client, db, key, move_company
):
    users, reports, foreign = _workspace(db)
    if move_company:
        users["worker"].company_id = foreign.id
        db.commit()
    original = reports[key]
    before = db.query(TaskReport).count()
    response = client.post(
        "/api/v1/task-reports/",
        headers=_headers(users["worker"]),
        json={
            "task_item_id": original.task_item_id,
            "client_event_id": original.client_event_id,
            "report_type": "note",
            "description": original.description,
        },
    )
    assert response.status_code == 404, response.text
    assert db.query(TaskReport).count() == before
    db.refresh(original)
    assert original.description == f"Private {key}"


def test_worker_report_history_keeps_queries_bounded(client, db):
    users, reports, _ = _workspace(db)
    headers = _headers(users["worker"])
    client.get("/api/v1/task-reports/", headers=headers)
    queries = []

    def capture(_connection, _cursor, statement, _parameters, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            queries.append(statement)

    event.listen(db.bind, "before_cursor_execute", capture)
    try:
        assert client.get("/api/v1/task-reports/", headers=headers).status_code == 200
        small = len(queries)
        for index in range(30):
            task = TaskItem(
                title=f"Assigned {index}",
                unit="servicio",
                company_id=users["worker"].company_id,
                location_id=reports["direct"].task_item.location_id,
                user_id=users["worker"].id,
                status="accepted",
            )
            db.add(task)
            db.flush()
            db.add(
                TaskReport(
                    task_item_id=task.id,
                    reporter_user_id=users["worker"].id,
                    reporter_company_id=task.company_id,
                    client_event_id=str(uuid4()),
                    report_type="note",
                    description="QA",
                    reporter_name="QA",
                )
            )
        db.commit()
        queries.clear()
        response = client.get("/api/v1/task-reports/", headers=headers)
        assert response.status_code == 200
        assert len(queries) <= small + 1
        assert len(queries) <= 20
    finally:
        event.remove(db.bind, "before_cursor_execute", capture)


@pytest.mark.parametrize("key", ["direct", "structured"])
def test_assigned_report_replay_remains_idempotent(client, db, key):
    users, reports, _ = _workspace(db)
    original = reports[key]
    before = db.query(TaskReport).count()
    response = client.post(
        "/api/v1/task-reports/",
        headers=_headers(users["worker"]),
        json={
            "task_item_id": original.task_item_id,
            "client_event_id": original.client_event_id,
            "report_type": "note",
            "description": original.description,
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["id"] == original.id
    assert db.query(TaskReport).count() == before


def test_mixed_worker_bulk_delete_is_atomic(client, db):
    users, reports, _ = _workspace(db)
    ids = [reports[key].id for key in ["direct", "reassigned"]]
    response = client.post(
        "/api/v1/task-reports/bulk-delete",
        headers=_headers(users["worker"]),
        json={"ids": ids},
    )
    assert response.status_code == 404, response.text
    assert db.query(TaskReport).filter(TaskReport.id.in_(ids)).count() == 2


def test_assignment_precedence_is_applied_before_task_pagination(client, db):
    from app.repositories import task_item as repository

    users, reports, _ = _workspace(db)
    worker = users["worker"]
    # Put the stale direct assignment first so post-filtering would leave a hole.
    reports["direct"].task_item.user_id = users["other"].id
    db.add(
        TaskAssignment(
            task_id=reports["direct"].task_item_id,
            user_id=users["other"].id,
            status="accepted",
            source="all",
        )
    )
    db.commit()
    expected = [reports["structured"].task_item_id]
    for skip, ids in [(0, expected), (1, [])]:
        tasks = repository.get_task_items(
            db,
            worker.company_id,
            user_id=worker.id,
            skip=skip,
            limit=1,
        )
        assert [task.id for task in tasks] == ids
        response = client.get(
            f"/api/v1/task-items/?skip={skip}&limit=1",
            headers=_headers(worker),
        )
        assert response.status_code == 200, response.text
        assert [task["id"] for task in response.json()] == ids
