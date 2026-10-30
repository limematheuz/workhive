import pytest
from sqlalchemy import event

from app.models.task_item import TaskItem
from app.models.task_structure import (
    TaskAssignment,
    TaskChecklistAssignment,
    TaskChecklistItem,
)
from test_task_structure import _company, _headers, _location, _user


def _source(db, *, mixed=False, count=2):
    company = _company(db, "Duplicate")
    admin = _user(db, company, "admin@duplicate.test", 1)
    worker = _user(db, company, "worker@duplicate.test", 3)
    location = _location(db, company)
    task = TaskItem(
        company_id=company.id,
        location_id=location.id,
        user_id=worker.id,
        title="Trabajo original",
        description="Nota libre",
        notes="Instrucciones",
        unit="servicio",
        price=15,
        quantity=2,
        priority="high",
        status="completed",
        checklist_evidence={"parsed_1": {"answer": "yes"}},
        attachments=[{"url": "/media/example.png"}],
    )
    db.add(task)
    db.flush()
    if mixed:
        task.description += f"\n- [x] Paso 0 (@{worker.id}:QA:completed)"
    task.assignments = [
        TaskAssignment(user_id=worker.id, source="all", status="completed")
    ]
    task.checklist_items = [
        TaskChecklistItem(
            position=index,
            text=f"Paso {index}",
            completed=True,
            space_name=None if mixed and index == 0 else "Cocina",
            source_line_index=1 if mixed and index == 0 else None,
            assignments=[
                TaskChecklistAssignment(user_id=worker.id, status="completed")
            ],
        )
        for index in range(count)
    ]
    db.commit()
    return admin, worker, task


@pytest.mark.parametrize("mixed", [False, True])
@pytest.mark.parametrize("role_id", [1, 2])
def test_duplicate_preserves_all_structured_steps_without_execution(
    client, db, mixed, role_id
):
    admin, worker, source = _source(db, mixed=mixed)
    actor = (
        admin if role_id == 1 else _user(db, admin.company, "manager@duplicate.test", 2)
    )
    original = client.get(
        f"/api/v1/task-items/{source.id}", headers=_headers(admin)
    ).json()
    response = client.post(
        f"/api/v1/task-items/{source.id}/duplicate", headers=_headers(actor)
    )
    assert response.status_code == 201, response.text
    copy = response.json()
    assert copy["id"] != source.id
    assert copy["title"] == source.title + " (Copia)"
    assert copy["status"] == "pending"
    assert copy["notes"] == source.notes
    assert [copy[key] for key in ("price", "quantity", "unit")] == [15, 2, "servicio"]
    assert [(item["text"], item["space_name"]) for item in copy["checklist_items"]] == [
        (item["text"], item["space_name"]) for item in original["checklist_items"]
    ]
    for item in copy["checklist_items"]:
        assert item["id"] not in {row["id"] for row in original["checklist_items"]}
        assert item["completed"] is False
        assert [(a["user_id"], a["status"]) for a in item["assignments"]] == [
            (worker.id, "pending")
        ]
    assert all(a["status"] == "pending" for a in copy["assignments"])
    for key in (
        "date_done",
        "scheduled_start_at",
        "due_at",
        "pricing_locked_at",
        "worked_seconds_snapshot",
    ):
        assert copy[key] is None
    assert copy["checklist_evidence"] == {}
    assert copy["attachments"] == []
    assert copy["is_invoiced"] is False
    assert "[x]" not in (copy["description"] or "")
    assert ":completed)" not in (copy["description"] or "")
    assert (
        client.get(f"/api/v1/task-items/{source.id}", headers=_headers(admin)).json()
        == original
    )
    assert (
        client.get(
            f"/api/v1/task-items/{copy['id']}", headers=_headers(worker)
        ).status_code
        == 200
    )


@pytest.mark.parametrize(
    "case, expected",
    [
        ("worker", 403),
        ("foreign", 404),
        ("invoiced", 409),
        ("inactive", 400),
        ("foreign_assignee", 400),
        ("missing", 404),
    ],
)
def test_duplicate_denials_do_not_create_or_modify_work(client, db, case, expected):
    admin, worker, source = _source(db)
    actor = admin
    source_id = source.id
    if case == "worker":
        actor = worker
    elif case == "foreign":
        actor = _user(db, _company(db, "Foreign"), "admin@foreign-duplicate.test", 1)
    elif case == "invoiced":
        source.is_invoiced = True
    elif case == "inactive":
        source.user_id = None
        worker.is_active = False
    elif case == "foreign_assignee":
        source.user_id = None
        worker.company_id = _company(db, "MovedWorker").id
    elif case == "missing":
        source_id += 1000
    db.commit()
    original = client.get(
        f"/api/v1/task-items/{source.id}", headers=_headers(admin)
    ).json()
    count = db.query(TaskItem).count()
    response = client.post(
        f"/api/v1/task-items/{source_id}/duplicate", headers=_headers(actor)
    )
    assert response.status_code == expected, response.text
    assert db.query(TaskItem).count() == count
    assert (
        client.get(f"/api/v1/task-items/{source.id}", headers=_headers(admin)).json()
        == original
    )


@pytest.mark.parametrize("count", [1, 30])
def test_duplicate_structure_queries_are_bounded(client, db, count):
    admin, _, source = _source(db, count=count)
    statements = []
    engine = db.get_bind()

    def capture(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", capture)
    try:
        response = client.post(
            f"/api/v1/task-items/{source.id}/duplicate", headers=_headers(admin)
        )
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    assert response.status_code == 201, response.text
    assert len(response.json()["checklist_items"]) == count
    assert len(statements) <= 80, len(statements)


def test_duplicate_preserves_shared_step_assignments(client, db):
    admin, worker, source = _source(db)
    other = _user(db, admin.company, "other@duplicate.test", 3)
    source.user_id = None
    source.assignments.append(
        TaskAssignment(user_id=other.id, source="checklist", status="progress")
    )
    source.checklist_items[0].assignments.append(
        TaskChecklistAssignment(user_id=other.id, status="review")
    )
    db.commit()
    response = client.post(
        f"/api/v1/task-items/{source.id}/duplicate", headers=_headers(admin)
    )
    assert response.status_code == 201, response.text
    copy = response.json()
    assert {
        (a["user_id"], a["status"]) for a in copy["checklist_items"][0]["assignments"]
    } == {
        (worker.id, "pending"),
        (other.id, "pending"),
    }
    assert {a["user_id"] for a in copy["assignments"]} == {worker.id, other.id}


def test_duplicate_requires_authentication(client, db):
    _, _, source = _source(db)
    response = client.post(f"/api/v1/task-items/{source.id}/duplicate")
    assert response.status_code == 401
    assert db.query(TaskItem).count() == 1


def test_duplicate_legacy_hourly_work_rebuilds_pending_steps(client, db):
    admin, worker, source = _source(db)
    source.checklist_items.clear()
    source.description = f"<!-- workhive_assignees:{worker.id} -->\n- [x] Revisar (@{worker.id}:QA:completed)"
    source.pricing_mode = "hourly"
    source.unit = "hour"
    db.commit()
    response = client.post(
        f"/api/v1/task-items/{source.id}/duplicate", headers=_headers(admin)
    )
    assert response.status_code == 201, response.text
    copy = response.json()
    assert copy["pricing_mode"] == "hourly"
    assert copy["unit"] == "hour"
    assert len(copy["checklist_items"]) == 1
    assert copy["checklist_items"][0]["text"] == "Revisar"
    assert copy["checklist_items"][0]["completed"] is False
    assert copy["checklist_items"][0]["assignments"][0]["status"] == "pending"


@pytest.mark.parametrize(
    "status", ["pending", "accepted", "rejected", "progress", "completed", "review"]
)
def test_duplicate_description_clears_every_assignment_status(status):
    from app.services.task_duplication_service import pending_description

    description = f"<!-- workhive_assignees:7 -->\nNota libre\n* [X] Cocina (@7:Ana Pérez: {status} )"
    assert (
        pending_description(description)
        == "<!-- workhive_assignees:7 -->\nNota libre\n* [ ] Cocina (@7:Ana Pérez:pending )"
    )


def test_duplicate_description_preserves_absent_and_free_instructions():
    from app.services.task_duplication_service import pending_description

    assert pending_description(None) is None
    assert pending_description("") is None
    text = "Texto (completed)\n<!-- categorías: Cocina -->"
    assert pending_description(text) == text
