from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from app.core.security import create_access_token
from app.models.company import Company
from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess
from app.models.task_item import TaskItem
from app.models.task_structure import TaskAssignment
from app.models.user import User
from app.repositories import task_item as task_item_repo
from app.services import task_assignment_service

CONTRACT_PATH = Path(__file__).resolve().parents[2] / "test_contracts" / "task_visibility.json"


def _company(db, name: str) -> Company:
    company = Company(
        name=name,
        tax_id=f"{name.upper()}-SEC",
        address="Security Street 1",
        phone="600000000",
        email=f"{name.lower()}@security.test",
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
    return {"Authorization": f"Bearer {token}"}


def _location(db, company: Company, name: str = "Casa Segura") -> Location:
    location = Location(
        name=name,
        address="Carrer Test 1",
        city="Girona",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


def _task_ids(response) -> set[int]:
    assert response.status_code == 200, response.text
    return {item["id"] for item in response.json()}


@pytest.fixture(autouse=True)
def _skip_calendar_background(monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.task_items.sync_user_calendar",
        lambda *args, **kwargs: None,
    )


def test_admin_task_reaches_assigned_admin_manager_and_viewer_only(client, db):
    company = _company(db, "Delivery")
    admin = _user(db, company, "admin@delivery.test", 1)
    manager = _user(db, company, "manager@delivery.test", 2)
    viewer = _user(db, company, "viewer@delivery.test", 3)
    other_viewer = _user(db, company, "other-viewer@delivery.test", 3)
    other_company = _company(db, "OtherDelivery")
    other_admin = _user(db, other_company, "admin@other-delivery.test", 1)
    location = _location(db, company)
    assignees = ",".join(str(user.id) for user in (admin, manager, viewer))

    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Trabajo visible por asignacion",
            "description": f"<!-- workhive_assignees:{assignees} -->",
            "unit": "servicio",
            "location_id": location.id,
            "status": "accepted",
        },
    )

    assert created.status_code == 201, created.text
    task_id = created.json()["id"]
    assert task_id in _task_ids(client.get("/api/v1/task-items/", headers=_headers(admin)))
    assert task_id in _task_ids(client.get("/api/v1/task-items/", headers=_headers(manager)))
    assert task_id in _task_ids(client.get("/api/v1/task-items/", headers=_headers(viewer)))
    assert task_id not in _task_ids(client.get("/api/v1/task-items/", headers=_headers(other_viewer)))

    cross_company_read = client.get(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(other_admin),
    )
    assert cross_company_read.status_code == 404

    viewer_create = client.post(
        "/api/v1/task-items/",
        headers=_headers(viewer),
        json={
            "title": "Intento viewer",
            "unit": "servicio",
            "location_id": location.id,
        },
    )
    assert viewer_create.status_code == 403

    viewer_global_update = client.patch(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(viewer),
        json={"status": "completed"},
    )
    assert viewer_global_update.status_code == 403

    viewer_delete = client.delete(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(viewer),
    )
    assert viewer_delete.status_code == 403


def test_backend_task_visibility_matches_shared_frontend_contract(db):
    contract = json.loads(CONTRACT_PATH.read_text())
    company = _company(db, "ContractVisibility")
    location = _location(db, company, "Casa Contrato")

    for case in contract["cases"]:
        task = TaskItem(
            title=case["name"],
            description=case["description"],
            unit="servicio",
            company_id=company.id,
            location_id=location.id,
            status="accepted",
        )
        db.add(task)
        db.flush()

        for user_id in case["assignedUserIds"]:
            assert task_assignment_service.is_user_assigned(task, user_id) is True
        for user_id in case["unassignedUserIds"]:
            assert task_assignment_service.is_user_assigned(task, user_id) is False

        checklist_by_user = case.get("checklistByUser") or {}
        parsed = task_assignment_service.parse_checklist(task.description)
        for user_id, expected_items in checklist_by_user.items():
            assert [
                item.text
                for item in parsed
                if item.assigned_user_id == int(user_id)
            ] == expected_items


def test_task_pagination_keeps_a_stable_complete_order(db):
    company = _company(db, "StablePagination")
    location = _location(db, company, "Casa Paginada")
    tasks = [
        TaskItem(
            title=f"Trabajo {index}",
            description="- [ ] Revisar",
            unit="servicio",
            company_id=company.id,
            location_id=location.id,
            status="accepted",
        )
        for index in range(105)
    ]
    db.add_all(tasks)
    db.commit()

    first_page = task_item_repo.get_task_items(db, company.id, limit=100)
    second_page = task_item_repo.get_task_items(db, company.id, skip=100, limit=100)
    expected_ids = [task.id for task in tasks]

    assert [task.id for task in first_page + second_page] == expected_ids


def test_viewer_can_progress_only_own_checklist_until_all_assignees_finish(client, db):
    company = _company(db, "Checklist")
    admin = _user(db, company, "admin@checklist.test", 1)
    first = _user(db, company, "first@checklist.test", 3)
    second = _user(db, company, "second@checklist.test", 3)
    third = _user(db, company, "third@checklist.test", 3)
    location = _location(db, company, "Casa Checklist")
    description = (
        f"- [ ] Cocina (@{first.id}:First:pending)\n"
        f"- [ ] Baños (@{second.id}:Second:pending)"
    )
    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Limpieza con reparto",
            "description": description,
            "unit": "servicio",
            "location_id": location.id,
            "status": "accepted",
        },
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]

    assert task_id in _task_ids(client.get("/api/v1/task-items/", headers=_headers(first)))
    assert task_id in _task_ids(client.get("/api/v1/task-items/", headers=_headers(second)))
    assert task_id not in _task_ids(client.get("/api/v1/task-items/", headers=_headers(third)))

    illegal_edit = client.patch(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(first),
        json={
            "description": description.replace(
                "- [ ] Baños",
                "- [x] Baños",
            )
        },
    )
    assert illegal_edit.status_code == 403

    start_first = client.post(
        f"/api/v1/task-items/{task_id}/start-work",
        headers=_headers(first),
        json={
            "start_latitude": 41.3851,
            "start_longitude": 2.1734,
            "start_accuracy_meters": 9,
        },
    )
    assert start_first.status_code == 200, start_first.text

    first_progress = start_first.json()["description"].replace(
        "- [ ] Cocina",
        "- [x] Cocina",
    )
    own_edit = client.patch(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(first),
        json={"description": first_progress},
    )
    assert own_edit.status_code == 200, own_edit.text

    finish_first = client.post(
        f"/api/v1/task-items/{task_id}/finish-work",
        headers=_headers(first),
    )
    assert finish_first.status_code == 200, finish_first.text
    assert finish_first.json()["status"] == "progress"

    task = db.get(TaskItem, task_id)
    assert task_assignment_service.get_user_assignment_status(task, first.id) == "completed"
    assert task_assignment_service.get_user_assignment_status(task, second.id) == "pending"

    start_second = client.post(
        f"/api/v1/task-items/{task_id}/start-work",
        headers=_headers(second),
        json={
            "start_latitude": 41.4,
            "start_longitude": 2.18,
        },
    )
    assert start_second.status_code == 200, start_second.text
    second_progress = start_second.json()["description"].replace(
        "- [ ] Baños",
        "- [x] Baños",
    )
    assert client.patch(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(second),
        json={"description": second_progress},
    ).status_code == 200

    finish_second = client.post(
        f"/api/v1/task-items/{task_id}/finish-work",
        headers=_headers(second),
    )
    assert finish_second.status_code == 200, finish_second.text
    assert finish_second.json()["status"] == "completed"


def test_external_company_can_create_tasks_only_when_location_grants_task_permission(client, db):
    owner = _company(db, "Owner")
    provider = _company(db, "Provider")
    blocked_provider = _company(db, "BlockedProvider")
    owner_admin = _user(db, owner, "admin@owner.test", 1)
    provider_manager = _user(db, provider, "manager@provider.test", 2)
    blocked_manager = _user(db, blocked_provider, "manager@blocked-provider.test", 2)
    provider_viewer = _user(db, provider, "viewer@provider.test", 3)
    location = _location(db, owner, "Casa Externa")
    db.add(
        LocationCompanyAccess(
            location_id=location.id,
            company_id=provider.id,
            relationship_type="service_provider",
            can_manage_tasks=True,
            can_view_sensitive=False,
        )
    )
    db.commit()

    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(provider_manager),
        json={
            "title": "Limpieza proveedor",
            "description": f"- [ ] Ejecutar servicio (@{provider_viewer.id}:Viewer:pending)",
            "unit": "servicio",
            "location_id": location.id,
            "status": "accepted",
            "price": 250,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["price"] is None
    task_id = created.json()["id"]
    assert task_id in _task_ids(
        client.get("/api/v1/task-items/", headers=_headers(provider_viewer))
    )
    assert task_id not in _task_ids(
        client.get("/api/v1/task-items/", headers=_headers(owner_admin))
    )

    denied = client.post(
        "/api/v1/task-items/",
        headers=_headers(blocked_manager),
        json={
            "title": "Sin permiso",
            "unit": "servicio",
            "location_id": location.id,
        },
    )
    assert denied.status_code == 404


def test_task_listing_performance_stays_linear_for_company_scope(client, db):
    company = _company(db, "PerfTasks")
    _user(db, company, "admin@perf.test", 1)
    viewer = _user(db, company, "viewer@perf.test", 3)
    location = _location(db, company, "Casa Rendimiento")
    tasks = [
        TaskItem(
                title=f"Task {index}",
                description=f"- [ ] Línea {index} (@{viewer.id}:Viewer:accepted)",
                unit="servicio",
                company_id=company.id,
                location_id=location.id,
                status="accepted",
            )
        for index in range(350)
    ]
    db.add_all(tasks)
    db.flush()
    db.add_all(
        TaskAssignment(
            task_id=task.id,
            user_id=viewer.id,
            status="accepted",
            source="checklist",
        )
        for task in tasks
    )
    db.commit()

    start = time.perf_counter()
    response = client.get(
        "/api/v1/task-items/?limit=350",
        headers=_headers(viewer),
    )
    elapsed = time.perf_counter() - start

    assert response.status_code == 200, response.text
    assert len(response.json()) == 350
    assert elapsed < 1.5
