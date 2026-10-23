from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.core.security import create_access_token
from app.models.company import Company
from app.models.location import Location
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.models.task_report import TaskReport
from app.models.task_structure import (
    TaskAssignment,
    TaskChecklistAssignment,
    TaskChecklistItem,
)
from app.models.user import User
from app.models.work_session import WorkSession


def _company(db, name: str) -> Company:
    company = Company(
        name=name,
        tax_id=f"{name.upper()}-MODAL",
        address="Modal Street 1",
        phone="600000001",
        email=f"{name.lower()}@modal.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _user(db, company: Company, email: str, role_id: int) -> User:
    user = User(
        email=email,
        hashed_password="unused",
        full_name=email.split("@", 1)[0],
        role_id=role_id,
        company_id=company.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return {"Authorization": "Bearer " + token}


def _location(db, company: Company) -> Location:
    location = Location(
        name="Casa Modal",
        address="Carrer Modal 1",
        city="Girona",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


def test_task_edit_modal_update_allows_owner_checklist_and_blocks_cross_tenant(client, db):
    company = _company(db, "ModalOwner")
    other = _company(db, "ModalOther")
    admin = _user(db, company, "admin@modal-owner.test", 1)
    stranger = _user(db, other, "admin@modal-other.test", 1)
    location = _location(db, company)

    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Modal checklist",
            "description": "- [ ] Cocina\n- [ ] Bano",
            "unit": "servicio",
            "location_id": location.id,
            "status": "progress",
            "priority": "medium",
        },
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]

    incomplete = client.patch(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(admin),
        json={
            "description": "- [x] Cocina\n- [ ] Bano",
            "status": "completed",
            "priority": "high",
        },
    )
    assert incomplete.status_code == 409, incomplete.text
    assert "checklist" in incomplete.json()["detail"].lower()

    updated = client.patch(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(admin),
        json={
            "description": "- [x] Cocina\n- [x] Bano",
            "status": "completed",
            "priority": "high",
        },
    )
    assert updated.status_code == 200, updated.text
    payload = updated.json()
    assert payload["status"] == "completed"
    assert payload["priority"] == "high"
    assert payload["checklist_items"][0]["completed"] is True
    assert payload["checklist_items"][1]["completed"] is True

    cross = client.patch(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(stranger),
        json={"title": "Hijack"},
    )
    assert cross.status_code == 404


def test_invoiced_task_cannot_be_deleted_from_modal_actions(client, db):
    company = _company(db, "ModalInvoice")
    admin = _user(db, company, "admin@modal-invoice.test", 1)
    location = _location(db, company)

    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Facturada",
            "description": "- [x] Hecho",
            "unit": "servicio",
            "location_id": location.id,
            "status": "completed",
        },
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]

    task = db.get(TaskItem, task_id)
    task.is_invoiced = True
    db.commit()

    deleted = client.delete(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(admin),
    )
    assert deleted.status_code == 400
    assert "invoiced" in deleted.json()["detail"].lower()


@pytest.mark.parametrize("activity", ["completed", "work_session", "field_report"])
def test_reservation_task_with_recorded_work_cannot_be_deleted_directly(client, db, activity):
    company = _company(db, f"TaskHistory{activity}")
    admin = _user(db, company, f"admin-{activity}@task-history.test", 1)
    other_company = _company(db, f"OtherTaskHistory{activity}")
    other_admin = _user(db, other_company, f"other-{activity}@task-history.test", 1)
    location = _location(db, company)
    check_in = datetime.now(timezone.utc) + timedelta(days=1)
    reservation = Reservation(
        location_id=location.id,
        owner_company_id=company.id,
        check_in_at=check_in,
        check_out_at=check_in + timedelta(days=2),
        guest_count=1,
    )
    db.add(reservation)
    db.commit()

    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Recorded reservation work",
            "description": "- [x] Done" if activity == "completed" else "- [ ] Pending",
            "unit": "service",
            "location_id": location.id,
            "status": "completed" if activity == "completed" else "accepted",
        },
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]
    task = db.get(TaskItem, task_id)
    task.checkout_reservation_id = reservation.id
    if activity == "work_session":
        db.add(WorkSession(
            user_id=admin.id,
            location_id=location.id,
            task_item_id=task_id,
            start_time=datetime.now(timezone.utc),
        ))
    elif activity == "field_report":
        db.add(TaskReport(
            task_item_id=task_id,
            reporter_user_id=admin.id,
            reporter_company_id=company.id,
            client_event_id="task-direct-delete-evidence",
            report_type="note",
            reporter_name=admin.full_name,
            description="Recorded field work",
        ))
    db.commit()

    denied = client.delete(f"/api/v1/task-items/{task_id}", headers=_headers(other_admin))
    assert denied.status_code == 404

    blocked = client.delete(f"/api/v1/task-items/{task_id}", headers=_headers(admin))
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["code"] == "RESERVATION_TASK_HAS_RECORDED_WORK"
    db.expire_all()
    assert db.get(TaskItem, task_id).checkout_reservation_id == reservation.id
    if activity == "work_session":
        assert db.query(WorkSession).filter_by(task_item_id=task_id).count() == 1
    elif activity == "field_report":
        assert db.query(TaskReport).filter_by(task_item_id=task_id).count() == 1


def test_reservation_task_without_activity_can_still_be_deleted(client, db):
    company = _company(db, "TaskWithoutActivity")
    admin = _user(db, company, "admin@task-no-activity.test", 1)
    location = _location(db, company)
    check_in = datetime.now(timezone.utc) + timedelta(days=1)
    reservation = Reservation(
        location_id=location.id,
        owner_company_id=company.id,
        check_in_at=check_in,
        check_out_at=check_in + timedelta(days=2),
        guest_count=1,
    )
    db.add(reservation)
    db.commit()

    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Unstarted reservation work",
            "description": "- [ ] Pending",
            "unit": "service",
            "location_id": location.id,
            "status": "accepted",
        },
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]
    task = db.get(TaskItem, task_id)
    task.checkout_reservation_id = reservation.id
    db.commit()

    deleted = client.delete(f"/api/v1/task-items/{task_id}", headers=_headers(admin))
    assert deleted.status_code == 204
    assert db.get(TaskItem, task_id) is None
    assert db.get(Reservation, reservation.id) is not None


def test_modal_checklist_toggle_and_assign_persist_in_database(client, db):
    """Mirrors edit-modal markdown updates and asserts relational rows stay in sync."""
    company = _company(db, "ModalChecklistDb")
    admin = _user(db, company, "admin@modal-checklist-db.test", 1)
    worker = _user(db, company, "worker@modal-checklist-db.test", 3)
    location = _location(db, company)

    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Checklist DB roundtrip",
            "description": "- [ ] Cocina\n- [ ] Bano\n- [ ] Terraza",
            "unit": "servicio",
            "location_id": location.id,
            "status": "progress",
        },
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]
    original_ids = {
        item["text"]: item["id"] for item in created.json()["checklist_items"]
    }
    assert set(original_ids) == {"Cocina", "Bano", "Terraza"}
    assert db.query(TaskChecklistItem).filter(TaskChecklistItem.task_id == task_id).count() == 3
    assert (
        db.query(TaskChecklistAssignment)
        .join(TaskChecklistItem)
        .filter(TaskChecklistItem.task_id == task_id)
        .count()
        == 0
    )

    # Same shape the modal builds after toggle + assign on markdown lines.
    updated = client.patch(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(admin),
        json={
            "description": (
                f"- [x] Cocina (@{worker.id}:{worker.full_name}:completed)\n"
                f"- [ ] Bano (@{worker.id}:{worker.full_name}:pending)\n"
                "- [ ] Terraza"
            ),
        },
    )
    assert updated.status_code == 200, updated.text
    payload = updated.json()

    by_text = {item["text"]: item for item in payload["checklist_items"]}
    assert by_text["Cocina"]["id"] == original_ids["Cocina"]
    assert by_text["Bano"]["id"] == original_ids["Bano"]
    assert by_text["Terraza"]["id"] == original_ids["Terraza"]
    assert by_text["Cocina"]["completed"] is True
    assert by_text["Bano"]["completed"] is False
    assert by_text["Terraza"]["completed"] is False
    assert by_text["Cocina"]["assignments"] == [
        {
            "user_id": worker.id,
            "user_name": worker.full_name,
            "status": "completed",
        }
    ]
    assert by_text["Bano"]["assignments"] == [
        {
            "user_id": worker.id,
            "user_name": worker.full_name,
            "status": "pending",
        }
    ]
    assert by_text["Terraza"]["assignments"] == []

    cocina = db.get(TaskChecklistItem, original_ids["Cocina"])
    bano = db.get(TaskChecklistItem, original_ids["Bano"])
    terraza = db.get(TaskChecklistItem, original_ids["Terraza"])
    assert cocina is not None and cocina.completed is True and cocina.text == "Cocina"
    assert bano is not None and bano.completed is False and bano.text == "Bano"
    assert terraza is not None and terraza.completed is False and terraza.text == "Terraza"

    assignment_rows = (
        db.query(TaskChecklistAssignment)
        .join(TaskChecklistItem)
        .filter(TaskChecklistItem.task_id == task_id)
        .order_by(TaskChecklistItem.position)
        .all()
    )
    assert len(assignment_rows) == 2
    assert {row.user_id for row in assignment_rows} == {worker.id}
    assert {row.checklist_item_id for row in assignment_rows} == {
        original_ids["Cocina"],
        original_ids["Bano"],
    }

    task_assignments = (
        db.query(TaskAssignment).filter(TaskAssignment.task_id == task_id).all()
    )
    assert len(task_assignments) == 1
    assert task_assignments[0].user_id == worker.id
    assert task_assignments[0].source == "checklist"

    refetch = client.get(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(admin),
    )
    assert refetch.status_code == 200, refetch.text
    refetch_by_text = {
        item["text"]: item for item in refetch.json()["checklist_items"]
    }
    assert refetch_by_text["Cocina"]["completed"] is True
    assert refetch_by_text["Cocina"]["assignments"][0]["user_id"] == worker.id
    assert refetch_by_text["Bano"]["assignments"][0]["status"] == "pending"
    assert refetch_by_text["Terraza"]["assignments"] == []

    # Unassign one item and clear completion — DB rows must shrink accordingly.
    cleared = client.patch(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(admin),
        json={"description": "- [ ] Cocina\n- [ ] Bano\n- [x] Terraza"},
    )
    assert cleared.status_code == 200, cleared.text
    db.expire_all()
    assert db.get(TaskChecklistItem, original_ids["Cocina"]).completed is False
    assert db.get(TaskChecklistItem, original_ids["Terraza"]).completed is True
    assert (
        db.query(TaskChecklistAssignment)
        .join(TaskChecklistItem)
        .filter(TaskChecklistItem.task_id == task_id)
        .count()
        == 0
    )
    assert db.query(TaskAssignment).filter(TaskAssignment.task_id == task_id).count() == 0


def test_modal_checklist_rejects_foreign_assignee_without_corrupting_db(client, db):
    company = _company(db, "ModalForeignDb")
    foreign = _company(db, "ModalForeignOther")
    admin = _user(db, company, "admin@modal-foreign-db.test", 1)
    foreign_worker = _user(db, foreign, "worker@modal-foreign-other.test", 3)
    location = _location(db, company)

    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Safe checklist",
            "description": "- [ ] Cocina\n- [ ] Bano",
            "unit": "servicio",
            "location_id": location.id,
        },
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]
    before_items = (
        db.query(TaskChecklistItem)
        .filter(TaskChecklistItem.task_id == task_id)
        .order_by(TaskChecklistItem.position)
        .all()
    )
    before_snapshot = [(row.id, row.text, row.completed) for row in before_items]

    rejected = client.patch(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(admin),
        json={
            "description": (
                f"- [x] Cocina (@{foreign_worker.id}:Foreign:completed)\n"
                "- [ ] Bano"
            ),
        },
    )
    assert rejected.status_code in {400, 403, 422}, rejected.text

    db.expire_all()
    after_items = (
        db.query(TaskChecklistItem)
        .filter(TaskChecklistItem.task_id == task_id)
        .order_by(TaskChecklistItem.position)
        .all()
    )
    assert [(row.id, row.text, row.completed) for row in after_items] == before_snapshot
    assert (
        db.query(TaskChecklistAssignment)
        .join(TaskChecklistItem)
        .filter(TaskChecklistItem.task_id == task_id)
        .count()
        == 0
    )
