from datetime import date, datetime, timedelta, timezone
import pytest
from app.models.staff_employee import StaffEmployee
from app.models.staff_account import StaffAccount
from app.models.staff_absence import StaffAbsence
from app.models.staff_shift import StaffShift
from app.models.task_item import TaskItem
from app.models.task_structure import TaskAssignment, TaskChecklistAssignment, TaskChecklistItem
from app.models.work_order import WorkOrder
from app.models.work_session import WorkSession
from app.models.workforce_plan import TaskSpaceStaff, StaffChecklistProgress
from tests.test_client_permission_authorization import _company, _bootstrap_admin, _headers, _user, _assign_company_profile
from test_service_contracts import _client, _location


def planned(client, db, suffix):
    company = _company(db, suffix)
    owner = _bootstrap_admin(db, company, suffix)
    headers = _headers(owner)
    users = [_user(db, company, suffix + str(index), role_id=3) for index in range(2)]
    people = [StaffEmployee(company_id=company.id, name=f"Operario {index}", position="Limpieza", team="", monthly_hours=160, hourly_cost=15) for index in range(2)]
    db.add_all(people); db.flush()
    db.add_all([StaffAccount(company_id=company.id, employee_id=person.id, user_id=users[index].id) for index, person in enumerate(people)])
    db.commit()
    location = _location(client, headers, _client(client, headers)["id"], spaces=[
        {"name": "Planta uno", "space_type": "office", "tasks": [{"title": "Mesas", "estimated_minutes": 60}]},
        {"name": "Planta dos", "space_type": "office", "tasks": [{"title": "Suelo", "estimated_minutes": 45}]},
    ])
    spaces = client.get(f"/api/v1/locations/{location['id']}/spaces", headers=headers).json()
    body = {"work_order": {"title": "Trabajo parcial", "location_id": location["id"], "status": "active", "scheduled_start_at": "2026-12-15T09:00:00Z"},
        "spaces": [{"space_id": spaces[0]["id"], "task_ids": [spaces[0]["tasks"][0]["id"]], "employee_ids": [people[0].id]}]}
    result = client.post("/api/v1/service-planning", headers=headers, json=body)
    assert result.status_code == 201, result.text
    return company, owner, headers, users, people, location, spaces, db.get(TaskItem, result.json()["task_id"])


def replacement(spaces, person):
    return {"spaces": [{"space_id": spaces[1]["id"], "task_ids": [spaces[1]["tasks"][0]["id"]], "employee_ids": [person.id], "planned_minutes": 90}]}


def test_scope_edit_replaces_only_generated_structure_and_keeps_manual_work(client, db):
    company, owner, headers, users, people, location, spaces, task = planned(client, db, "scope-edit")
    task.notes = "Código de alarma confirmado por oficina"
    manual = TaskChecklistItem(task=task, position=20, text="Comprobar la alarma", assignments=[TaskChecklistAssignment(user_id=owner.id, status="pending")])
    db.add_all([manual, TaskAssignment(task=task, user_id=owner.id, source="checklist", status="pending")]); db.commit()
    manual_id = manual.id
    initial = client.get(f"/api/v1/workforce-execution/{task.id}/scope", headers=headers)
    assert initial.status_code == 200, initial.text
    assert initial.json()["can_edit"] is True
    assert "hourly_cost" not in initial.text and "monthly_hours" not in initial.text
    changed = client.put(f"/api/v1/workforce-execution/{task.id}/scope", headers=headers, json=replacement(spaces, people[1]))
    assert changed.status_code == 200, changed.text
    db.expire_all(); task = db.get(TaskItem, task.id)
    assert task.notes == "Código de alarma confirmado por oficina"
    assert {(item.id, item.text) for item in task.checklist_items if item.location_space_task_template_id is None} == {(manual_id, "Comprobar la alarma")}
    assert [item.text for item in task.checklist_items if item.location_space_task_template_id] == ["Suelo"]
    assert [zone.zone_id for zone in task.zones] == [spaces[1]["id"]]
    assert {assignment.user_id for assignment in task.assignments} == {owner.id, users[1].id}
    allocations = db.query(TaskSpaceStaff).filter_by(task_id=task.id).all()
    assert len(allocations) == 1 and allocations[0].employee_id == people[1].id
    shifts = db.query(StaffShift).filter_by(task_id=task.id).all()
    assert len(shifts) == 1 and shifts[0].employee_id == people[1].id
    assert shifts[0].ends_at - shifts[0].starts_at == timedelta(minutes=90)
    again = client.put(f"/api/v1/workforce-execution/{task.id}/scope", headers=headers, json=replacement(spaces, people[1]))
    assert again.status_code == 200, again.text
    assert db.query(StaffShift).filter_by(task_id=task.id).count() == 1
    assert db.query(TaskSpaceStaff).filter_by(task_id=task.id).count() == 1


def test_scope_edit_rolls_back_checklists_allocations_and_shifts_on_overlap(client, db):
    company, owner, headers, users, people, location, spaces, task = planned(client, db, "scope-overlap")
    original_checklist = task.checklist_items[0].id
    db.add(StaffShift(company_id=company.id, employee_id=people[1].id, location_id=location["id"], starts_at=task.scheduled_start_at, ends_at=task.scheduled_start_at + timedelta(hours=1)))
    db.commit()
    response = client.put(f"/api/v1/workforce-execution/{task.id}/scope", headers=headers, json=replacement(spaces, people[1]))
    assert response.status_code == 409, response.text
    db.expire_all(); task = db.get(TaskItem, task.id)
    assert [item.id for item in task.checklist_items] == [original_checklist]
    assert [zone.zone_id for zone in task.zones] == [spaces[0]["id"]]
    assert db.query(TaskSpaceStaff).filter_by(task_id=task.id).one().employee_id == people[0].id
    assert db.query(StaffShift).filter_by(task_id=task.id).one().employee_id == people[0].id


@pytest.mark.parametrize("activity", ["session", "individual_progress", "invoiced", "completed", "operational_note"])
def test_scope_edit_is_closed_after_any_recorded_work_or_invoice(client, db, activity):
    company, owner, headers, users, people, location, spaces, task = planned(client, db, "scope-" + activity)
    if activity == "session":
        now = datetime.now(timezone.utc)
        db.add(WorkSession(user_id=users[0].id, location_id=location["id"], task_item_id=task.id, start_time=now-timedelta(hours=1), end_time=now))
    elif activity == "individual_progress":
        allocation = db.query(TaskSpaceStaff).filter_by(task_id=task.id).one()
        db.query(StaffChecklistProgress).filter_by(allocation_id=allocation.id).one().completed_by = owner.id
    elif activity == "invoiced":
        task.is_invoiced = True
    elif activity == "completed":
        task.status = "completed"
    else:
        task.operational_notes = [{"text": "Se ha iniciado la intervención"}]
    db.commit()
    overview = client.get(f"/api/v1/workforce-execution/{task.id}/scope", headers=headers)
    assert overview.status_code == 200 and overview.json()["can_edit"] is False
    response = client.put(f"/api/v1/workforce-execution/{task.id}/scope", headers=headers, json=replacement(spaces, people[1]))
    assert response.status_code == 409, response.text
    assert db.query(TaskSpaceStaff).filter_by(task_id=task.id).one().employee_id == people[0].id


def test_scope_edit_enforces_company_location_and_task_template_boundaries(client, db):
    company, owner, headers, users, people, location, spaces, task = planned(client, db, "scope-boundary")
    foreign_company = _company(db, "scope-foreign")
    foreign_admin = _bootstrap_admin(db, foreign_company, "scope-foreign")
    assert client.get(f"/api/v1/workforce-execution/{task.id}/scope", headers=_headers(foreign_admin)).status_code == 404
    assert client.put(f"/api/v1/workforce-execution/{task.id}/scope", headers=_headers(foreign_admin), json=replacement(spaces, people[1])).status_code == 404
    assert client.get(f"/api/v1/workforce-execution/{task.id}/scope", headers=_headers(users[0])).status_code == 403
    other_location = _location(client, headers, _client(client, headers)["id"], spaces=[{"name": "Otra planta", "space_type": "office", "tasks": [{"title": "Otra tarea", "estimated_minutes": 30}]}])
    narrow = _user(db, company, "scope-narrow", role_id=3)
    _assign_company_profile(db, company=company, admin=owner, user=narrow, name="Solo otra ubicación", permission_codes={"work.read", "work.manage"}, scope_type="location", scope_id=other_location["id"])
    assert client.get(f"/api/v1/workforce-execution/{task.id}/scope", headers=_headers(narrow)).status_code == 403
    invalid = replacement(spaces, people[1]); invalid["spaces"][0]["task_ids"] = [spaces[0]["tasks"][0]["id"]]
    assert client.put(f"/api/v1/workforce-execution/{task.id}/scope", headers=headers, json=invalid).status_code == 422
    assert db.query(TaskSpaceStaff).filter_by(task_id=task.id).one().employee_id == people[0].id


def test_aggregate_space_duration_cannot_cross_an_uncovered_absence(client, db):
    company, owner, headers, users, people, location, spaces, task = planned(client, db, "scope-whole-shift")
    db.add(StaffAbsence(company_id=company.id, employee_id=people[0].id, starts_on=date(2026, 12, 16), ends_on=date(2026, 12, 16), kind="vacation")); db.commit()
    before = db.query(WorkOrder).filter_by(company_id=company.id).count()
    body = {"work_order": {"title": "La suma cruza medianoche", "location_id": location["id"], "status": "active", "scheduled_start_at": "2026-12-15T21:00:00Z"},
        "spaces": [{"space_id": space["id"], "task_ids": [space["tasks"][0]["id"]], "employee_ids": [people[0].id], "planned_minutes": 90} for space in spaces]}
    response = client.post("/api/v1/service-planning", headers=headers, json=body)
    assert response.status_code == 409, response.text
    assert db.query(WorkOrder).filter_by(company_id=company.id).count() == before
    assert db.query(TaskSpaceStaff).filter_by(company_id=company.id).count() == 1


def test_absence_substitute_must_still_be_active_at_generation(client, db):
    company, owner, headers, users, people, location, spaces, task = planned(client, db, "scope-inactive-cover")
    people[1].profile = {"state": "Baja"}
    db.add(StaffAbsence(company_id=company.id, employee_id=people[0].id, substitute_id=people[1].id, starts_on=date(2026, 12, 17), ends_on=date(2026, 12, 17), kind="vacation")); db.commit()
    response = client.post("/api/v1/service-planning", headers=headers, json={"work_order": {"title": "Cobertura archivada", "location_id": location["id"], "status": "active", "scheduled_start_at": "2026-12-17T09:00:00Z"},
        "spaces": [{"space_id": spaces[0]["id"], "task_ids": [spaces[0]["tasks"][0]["id"]], "employee_ids": [people[0].id]}]})
    assert response.status_code == 409, response.text
    assert db.query(TaskSpaceStaff).filter_by(company_id=company.id).count() == 1


def test_manager_checklist_draft_updates_individual_progress_consistently(client, db):
    company, owner, headers, users, people, location, spaces, task = planned(client, db, "scope-manager-check")
    checklist_id = task.checklist_items[0].id
    response = client.patch(f"/api/v1/task-items/{task.id}", headers=headers, json={"checklist_updates": [{"id": checklist_id, "completed": True}]})
    assert response.status_code == 200, response.text
    db.expire_all()
    allocation = db.query(TaskSpaceStaff).filter_by(task_id=task.id).one()
    progress = db.query(StaffChecklistProgress).filter_by(allocation_id=allocation.id, checklist_id=checklist_id).one()
    assert progress.completed is True and progress.completed_by == owner.id and progress.answer == "yes"
    task = db.get(TaskItem, task.id)
    assert task.checklist_items[0].completed is True and task.status == "completed"
    assert task.checklist_evidence[f"item_{checklist_id}"]["answer"] == "yes"


def test_classic_task_edit_preserves_allocated_scope_and_allows_ordinary_notes(client, db):
    company, owner, headers, users, people, location, spaces, task = planned(client, db, "scope-classic-edit")
    original_start = task.scheduled_start_at
    for body in ({"space_ids": [spaces[1]["id"]]}, {"space_ids": []}, {"scheduled_start_at": "2026-12-16T09:00:00Z"}, {"due_at": "2026-12-16T11:00:00Z"}):
        response = client.patch(f"/api/v1/task-items/{task.id}", headers=headers, json=body)
        assert response.status_code == 409, response.text
    assignee_change = client.patch(f"/api/v1/task-items/{task.id}", headers=headers, json={"checklist_updates": [{"id": task.checklist_items[0].id, "assigned_user_ids": [users[1].id]}]})
    assert assignee_change.status_code == 409, assignee_change.text
    allowed = client.patch(f"/api/v1/task-items/{task.id}", headers=headers, json={"notes": "Nota administrativa", "space_ids": [spaces[0]["id"]], "scheduled_start_at": "2026-12-15T09:00:00+00:00"})
    assert allowed.status_code == 200, allowed.text
    db.expire_all(); task = db.get(TaskItem, task.id)
    assert task.notes == "Nota administrativa" and task.scheduled_start_at == original_start
    assert [zone.zone_id for zone in task.zones] == [spaces[0]["id"]]
    assert db.query(TaskSpaceStaff).filter_by(task_id=task.id).one().employee_id == people[0].id


def test_accepted_quote_scope_allows_reassignment_and_preserves_agreed_subject(client, db):
    from test_estimator_execution import accepted_scope
    company, headers, location, spaces, person, body, contract, calculated = accepted_scope(client, db)
    created = client.post("/api/v1/service-planning", headers=headers, json={"work_order": {"title": "Ejecución pactada", "location_id": location["id"], "service_contract_id": contract["id"], "status": "active", "scheduled_start_at": "2026-12-18T09:00:00Z"}, "spaces": body["spaces"]})
    assert created.status_code == 201, created.text
    task = db.get(TaskItem, created.json()["task_id"])
    price = task.price
    other = StaffEmployee(company_id=company.id, name="Refuerzo", position="Limpieza", team="", monthly_hours=160, hourly_cost=18)
    db.add(other); db.commit()
    selection = {"spaces": [{"space_id": spaces[0]["id"], "task_ids": [spaces[0]["tasks"][0]["id"]], "employee_ids": [other.id], "planned_minutes": 90}]}
    allowed = client.put(f"/api/v1/workforce-execution/{task.id}/scope", headers=headers, json=selection)
    assert allowed.status_code == 200, allowed.text
    denied = client.put(f"/api/v1/workforce-execution/{task.id}/scope", headers=headers, json=replacement(spaces, person))
    assert denied.status_code == 409 and "presupuesto aceptado" in denied.text
    db.expire_all(); task = db.get(TaskItem, task.id)
    assert task.price == price and task.price is not None
    assert [zone.zone_id for zone in task.zones] == [spaces[0]["id"]]
    assert db.query(TaskSpaceStaff).filter_by(task_id=task.id).one().employee_id == other.id


def test_scope_input_bounds_tasks_before_querying_or_mutating_records(client, db):
    company, owner, headers, users, people, location, spaces, task = planned(client, db, "scope-task-limit")
    selections = [{"space_id": spaces[0]["id"], "task_ids": list(range(1, 201)), "employee_ids": []},
        {"space_id": spaces[1]["id"], "task_ids": [201], "employee_ids": []}]
    response = client.put(f"/api/v1/workforce-execution/{task.id}/scope", headers=headers, json={"spaces": selections})
    assert response.status_code == 422 and "200 tareas" in response.text
    response = client.post("/api/v1/service-planning", headers=headers, json={"work_order": {"title": "Demasiadas tareas", "location_id": location["id"], "status": "active", "scheduled_start_at": "2026-12-19T09:00:00Z"}, "spaces": selections})
    assert response.status_code == 422 and "200 tareas" in response.text
    assert db.query(TaskSpaceStaff).filter_by(task_id=task.id).one().employee_id == people[0].id
