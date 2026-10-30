from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import event

from app.models.task_item import TaskItem
from app.models.reservation import Reservation
from app.models.task_structure import TaskChecklistAssignment, TaskChecklistItem
from test_task_duplication import _source
from test_task_structure import _company, _headers, _user


def _editable(db, mixed=False, count=2):
    admin, worker, task = _source(db, mixed=mixed, count=count)
    task.status = "pending"
    task.date_done = None
    if mixed:
        task.description = f"Nota libre\n- [ ] Paso 0 (@{worker.id}:QA:pending)"
    for item in task.checklist_items:
        item.completed = False
        for assignment in item.assignments:
            assignment.status = "pending"
    for assignment in task.assignments:
        assignment.status = "pending"
    task.checklist_evidence = {}
    db.commit()
    return admin, worker, task


@pytest.mark.parametrize("mixed", [False, True])
@pytest.mark.parametrize("role_id", [1, 2])
def test_manager_saves_structured_answer_and_assignment_atomically(
    client, db, mixed, role_id
):
    admin, worker, task = _editable(db, mixed)
    actor = (
        admin
        if role_id == 1
        else _user(db, admin.company, "manager@checklist-edit.test", 2)
    )
    path = f"/api/v1/task-items/{task.id}"
    before = client.get(path, headers=_headers(admin)).json()
    item = task.checklist_items[-1]
    response = client.patch(
        path,
        headers=_headers(actor),
        json={
            "notes": "Nota y requisito",
            "description": task.description,
            "user_id": worker.id,
            "checklist_updates": [
                {"id": item.id, "completed": True, "assigned_user_ids": [actor.id]}
            ],
        },
    )
    assert response.status_code == 200, response.text
    after = response.json()
    assert after["notes"] == "Nota y requisito"
    assert after["checklist_items"][0] == before["checklist_items"][0]
    changed = after["checklist_items"][-1]
    assert changed["id"] == item.id
    assert changed["space_name"] == "Cocina"
    assert changed["source_line_index"] is None
    assert changed["completed"] is True
    assert [(a["user_id"], a["status"]) for a in changed["assignments"]] == [
        (actor.id, "completed")
    ]
    assert after["checklist_evidence"][f"item_{item.id}"]["answer"] == "yes"
    assert after["description"] == before["description"]


@pytest.mark.parametrize(
    "case, expected",
    [
        ("worker", 403),
        ("foreign", 404),
        ("foreign_item", 404),
        ("linked", 400),
        ("inactive", 400),
        ("foreign_assignee", 400),
        ("invoiced", 409),
        ("duplicate", 422),
        ("null", 422),
        ("empty", 422),
        ("unknown_field", 422),
        ("evidence", 422),
        ("incomplete", 409),
        ("locked_price", 409),
    ],
)
def test_invalid_structured_edit_preserves_full_task(client, db, case, expected):
    admin, worker, task = _editable(db, mixed=True)
    actor = admin
    edit = {"id": task.checklist_items[-1].id, "completed": True}
    data = {"notes": "No guardar", "checklist_updates": [edit]}
    if case == "worker":
        actor = worker
        data.pop("notes")
    elif case == "foreign":
        actor = _user(
            db, _company(db, "OtherChecklist"), "admin@other-checklist.test", 1
        )
    elif case == "foreign_item":
        other = TaskItem(
            company_id=task.company_id,
            location_id=task.location_id,
            title="Otra tarea",
            unit="servicio",
        )
        db.add(other)
        db.flush()
        foreign_item = TaskChecklistItem(
            task_id=other.id, position=0, text="Paso ajeno"
        )
        db.add(foreign_item)
        db.flush()
        data["checklist_updates"].insert(
            0, {"id": task.checklist_items[-1].id, "completed": True}
        )
        edit["id"] = foreign_item.id
    elif case == "linked":
        edit["id"] = task.checklist_items[0].id
    elif case == "inactive":
        worker.is_active = False
        edit["assigned_user_ids"] = [worker.id]
    elif case == "foreign_assignee":
        foreign = _user(
            db, _company(db, "OtherAssignee"), "worker@other-checklist.test", 3
        )
        edit["assigned_user_ids"] = [foreign.id]
    elif case == "invoiced":
        task.is_invoiced = True
    elif case == "duplicate":
        data["checklist_updates"].append(dict(edit))
    elif case == "null":
        data["checklist_updates"] = None
    elif case == "empty":
        edit.pop("completed")
    elif case == "unknown_field":
        edit["text"] = "No reemplazar definición"
    elif case == "evidence":
        data["checklist_evidence"] = {}
    elif case == "incomplete":
        data["status"] = "completed"
    elif case == "locked_price":
        task.pricing_locked_at = datetime.now(timezone.utc)
        data["price"] = 999
    db.commit()
    path = f"/api/v1/task-items/{task.id}"
    before = client.get(path, headers=_headers(admin)).json()
    response = client.patch(path, headers=_headers(actor), json=data)
    assert response.status_code == expected, response.text
    assert client.get(path, headers=_headers(admin)).json() == before


def test_structured_edits_can_finish_all_steps_in_one_save(client, db):
    admin, _, task = _editable(db)
    response = client.patch(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(admin),
        json={
            "status": "completed",
            "checklist_updates": [
                {"id": item.id, "completed": True} for item in task.checklist_items
            ],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "completed"
    assert all(item["completed"] for item in response.json()["checklist_items"])


def test_answer_edit_preserves_shared_assignments_and_other_evidence(client, db):
    admin, worker, task = _editable(db)
    item = task.checklist_items[0]
    item.assignments.append(TaskChecklistAssignment(user_id=admin.id, status="pending"))
    task.checklist_evidence = {
        f"item_{item.id}": {"note": "Conservar", "photos": ["/media/qa.png"]}
    }
    db.commit()
    response = client.patch(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(admin),
        json={
            "checklist_updates": [{"id": item.id, "completed": True}],
        },
    )
    assert response.status_code == 200, response.text
    after = response.json()
    assert {a["user_id"] for a in after["checklist_items"][0]["assignments"]} == {
        admin.id,
        worker.id,
    }
    assert after["checklist_evidence"][f"item_{item.id}"] == {
        "note": "Conservar",
        "photos": ["/media/qa.png"],
        "answer": "yes",
    }


def test_receiving_company_manager_edits_own_work_without_granting_owner_write_access(
    client, db
):
    admin, _, task = _editable(db)
    owner = _company(db, "PropertyOwner")
    owner_admin = _user(db, owner, "admin@property-owner-checklist.test", 1)
    task.location.owner_company_id = owner.id
    task.location.managing_company_id = owner.id
    check_in = datetime.now(timezone.utc) + timedelta(days=1)
    reservation = Reservation(
        location_id=task.location_id,
        owner_company_id=owner.id,
        assigned_company_id=task.company_id,
        check_in_at=check_in,
        check_out_at=check_in + timedelta(days=2),
    )
    db.add(reservation)
    db.flush()
    task.checkout_reservation_id = reservation.id
    db.commit()
    path = f"/api/v1/task-items/{task.id}"
    data = {
        "checklist_updates": [{"id": task.checklist_items[0].id, "completed": True}]
    }
    response = client.patch(path, headers=_headers(admin), json=data)
    assert response.status_code == 200, response.text
    assert response.json()["checklist_items"][0]["completed"] is True
    before = client.get(path, headers=_headers(admin)).json()
    denied = client.patch(path, headers=_headers(owner_admin), json=data)
    assert denied.status_code == 404, denied.text
    assert client.get(path, headers=_headers(admin)).json() == before


@pytest.mark.parametrize("count", [1, 30])
def test_structured_edit_queries_are_bounded(client, db, count):
    admin, worker, task = _editable(db, count=count)
    edits = [
        {"id": item.id, "assigned_user_ids": [worker.id]}
        for item in task.checklist_items
    ]
    selects = []
    engine = db.get_bind()

    def capture(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            selects.append(statement)

    event.listen(engine, "before_cursor_execute", capture)
    try:
        response = client.patch(
            f"/api/v1/task-items/{task.id}",
            headers=_headers(admin),
            json={"checklist_updates": edits},
        )
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    assert response.status_code == 200, response.text
    assert len(selects) <= 80, len(selects)
