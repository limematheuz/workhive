from app.core.security import create_access_token
from app.models.company import Company
from app.models.location import Location
from app.models.task_item import TaskItem
from app.models.task_structure import (
    TaskAssignment,
    TaskChecklistAssignment,
    TaskChecklistItem,
)
from app.models.user import User


def _company(db, name: str) -> Company:
    company = Company(
        name=name,
        tax_id=f"{name.upper()}-STRUCT",
        address="Calle Structure 1",
        phone="600000000",
        email=f"{name.lower()}@structure.test",
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
        company_id=company.id,
        role_id=role_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return {"Authorization": f"Bearer {token}"}


def _location(db, company: Company) -> Location:
    location = Location(
        name="Casa Structure",
        address="Calle Structure 2",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


def test_create_backfills_structured_checklist_and_assignments(client, db):
    company = _company(db, "CreateStructure")
    admin = _user(db, company, "admin@create-structure.test", 1)
    viewer = _user(db, company, "viewer@create-structure.test", 3)
    location = _location(db, company)

    response = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Tarea estructurada",
            "description": (
                f"<!-- workhive_assignees:{viewer.id} -->\n"
                f"- [ ] Cocina (@{viewer.id}:Victoria:pending)\n"
                "- [x] Baño"
            ),
            "unit": "servicio",
            "location_id": location.id,
            "checklist_evidence": {
                "parsed_1": {"answer": "no", "note": "Revisar cocina"}
            },
        },
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert [item["text"] for item in payload["checklist_items"]] == ["Cocina", "Baño"]
    assert payload["checklist_items"][1]["completed"] is True
    assert payload["checklist_items"][0]["assignments"] == [
        {"user_id": viewer.id, "user_name": viewer.full_name, "status": "pending"}
    ]
    assert payload["assignments"] == [
        {"user_id": viewer.id, "user_name": viewer.full_name, "status": "pending", "source": "checklist"}
    ]
    assert db.query(TaskChecklistItem).count() == 2
    assert db.query(TaskChecklistAssignment).count() == 1
    assert db.query(TaskAssignment).count() == 1
    assert payload["checklist_evidence"][f"item_{payload['checklist_items'][0]['id']}"] == {
        "answer": "no",
        "note": "Revisar cocina",
    }


def test_foreign_assignee_metadata_is_rejected_without_partial_write(client, db):
    company = _company(db, "SecureStructure")
    foreign = _company(db, "ForeignStructure")
    admin = _user(db, company, "admin@secure-structure.test", 1)
    foreign_viewer = _user(db, foreign, "viewer@foreign-structure.test", 3)
    location = _location(db, company)

    response = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Asignación cruzada",
            "description": f"- [ ] Cocina (@{foreign_viewer.id}:Foreign:pending)",
            "unit": "servicio",
            "location_id": location.id,
        },
    )

    assert response.status_code == 400
    assert db.query(TaskItem).filter(TaskItem.title == "Asignación cruzada").count() == 0
    assert db.query(TaskAssignment).count() == 0


def test_viewer_query_uses_relational_assignment_not_markdown(client, db):
    company = _company(db, "QueryStructure")
    admin = _user(db, company, "admin@query-structure.test", 1)
    viewer = _user(db, company, "viewer@query-structure.test", 3)
    location = _location(db, company)
    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Sin metadatos Markdown",
            "description": f"- [ ] Cocina (@{viewer.id}:Viewer:pending)",
            "unit": "servicio",
            "location_id": location.id,
        },
    )
    task = db.get(TaskItem, created.json()["id"])
    task.description = "- [ ] Cocina"
    db.commit()

    response = client.get("/api/v1/task-items/", headers=_headers(viewer))

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [task.id]


def test_task_list_consumers_serialize_structured_data_for_admin_and_viewer(client, db):
    company = _company(db, "ConsumerStructure")
    admin = _user(db, company, "admin@consumer-structure.test", 1)
    viewer = _user(db, company, "viewer@consumer-structure.test", 3)
    location = _location(db, company)
    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Calendar and profile task",
            "description": f"- [ ] Cocina (@{viewer.id}:Viewer:accepted)",
            "unit": "servicio",
            "location_id": location.id,
        },
    ).json()

    admin_calendar = client.get(
        "/api/v1/task-items/?limit=500",
        headers=_headers(admin),
    )
    admin_profile = client.get(
        f"/api/v1/task-items/?user_id={viewer.id}&limit=100",
        headers=_headers(admin),
    )
    viewer_dashboard = client.get(
        "/api/v1/task-items/?limit=100",
        headers=_headers(viewer),
    )

    for response in (admin_calendar, admin_profile, viewer_dashboard):
        assert response.status_code == 200, response.text
        payload = response.json()
        assert [task["id"] for task in payload] == [created["id"]]
        assert payload[0]["checklist_items"][0]["text"] == "Cocina"
        assert payload[0]["assignments"][0]["user_id"] == viewer.id


def test_description_update_preserves_matching_item_ids_and_removes_stale_rows(client, db):
    company = _company(db, "UpdateStructure")
    admin = _user(db, company, "admin@update-structure.test", 1)
    viewer = _user(db, company, "viewer@update-structure.test", 3)
    location = _location(db, company)
    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Editar estructura",
            "description": f"- [ ] Cocina (@{viewer.id}:Viewer:pending)\n- [ ] Baño",
            "unit": "servicio",
            "location_id": location.id,
        },
    ).json()
    original_ids = {item["text"]: item["id"] for item in created["checklist_items"]}

    updated = client.patch(
        f"/api/v1/task-items/{created['id']}",
        headers=_headers(admin),
        json={"description": f"- [x] Cocina (@{viewer.id}:Viewer:completed)\n- [ ] Terraza"},
    )

    assert updated.status_code == 200, updated.text
    payload = updated.json()
    assert payload["checklist_items"][0]["id"] == original_ids["Cocina"]
    assert payload["checklist_items"][0]["completed"] is True
    assert [item["text"] for item in payload["checklist_items"]] == ["Cocina", "Terraza"]
    assert db.query(TaskChecklistItem).filter(TaskChecklistItem.id == original_ids["Baño"]).count() == 0


def test_worker_can_update_only_own_structured_checklist_item(client, db):
    company = _company(db, "ItemSecurity")
    admin = _user(db, company, "admin@item-security.test", 1)
    first = _user(db, company, "first@item-security.test", 3)
    second = _user(db, company, "second@item-security.test", 3)
    location = _location(db, company)
    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Items protegidos",
            "description": (
                f"- [ ] Cocina (@{first.id}:First:pending)\n"
                f"- [ ] Baño (@{second.id}:Second:pending)"
            ),
            "unit": "servicio",
            "location_id": location.id,
        },
    ).json()
    own_item, foreign_item = created["checklist_items"]

    forbidden = client.patch(
        f"/api/v1/task-items/{created['id']}/checklist-items/{foreign_item['id']}",
        headers=_headers(first),
        json={"completed": True},
    )
    allowed = client.patch(
        f"/api/v1/task-items/{created['id']}/checklist-items/{own_item['id']}",
        headers=_headers(first),
        json={"completed": True},
    )

    assert forbidden.status_code == 403
    assert allowed.status_code == 200, allowed.text
    assert allowed.json()["checklist_items"][0]["completed"] is True
    db.refresh(db.get(TaskChecklistItem, own_item["id"]))
    assert db.get(TaskChecklistItem, own_item["id"]).completed is True


def test_inactive_and_unknown_assignees_are_rejected(client, db):
    company = _company(db, "InactiveStructure")
    admin = _user(db, company, "admin@inactive-structure.test", 1)
    inactive = _user(db, company, "inactive@inactive-structure.test", 3)
    inactive.is_active = False
    db.commit()
    location = _location(db, company)

    for invalid_user_id in (inactive.id, 999_999):
        response = client.post(
            "/api/v1/task-items/",
            headers=_headers(admin),
            json={
                "title": f"Invalid {invalid_user_id}",
                "description": f"<!-- workhive_assignees:{invalid_user_id} -->\n- [ ] Cocina",
                "unit": "servicio",
                "location_id": location.id,
            },
        )
        assert response.status_code == 400

    assert db.query(TaskItem).count() == 0


def test_structured_no_answer_is_complete_without_becoming_yes(client, db):
    company = _company(db, "NoAnswerStructure")
    admin = _user(db, company, "admin@no-answer-structure.test", 1)
    viewer = _user(db, company, "viewer@no-answer-structure.test", 3)
    location = _location(db, company)
    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Respuesta negativa",
            "description": f"- [ ] Alarma activada (@{viewer.id}:Viewer:pending)",
            "unit": "servicio",
            "location_id": location.id,
        },
    ).json()

    response = client.patch(
        f"/api/v1/task-items/{created['id']}/checklist-items/{created['checklist_items'][0]['id']}",
        headers=_headers(viewer),
        json={"completed": True, "answer": "no"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["checklist_items"][0]["completed"] is True
    assert payload["checklist_evidence"][f"item_{created['checklist_items'][0]['id']}"]["answer"] == "no"
    assert "- [ ] Alarma activada" in payload["description"]
    assert payload["status"] == "completed"


def test_manager_can_update_structured_item(client, db):
    company = _company(db, "ManagerStructure")
    admin = _user(db, company, "admin@manager-structure.test", 1)
    manager = _user(db, company, "manager@manager-structure.test", 2)
    viewer = _user(db, company, "viewer@manager-structure.test", 3)
    location = _location(db, company)
    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Manager update",
            "description": f"- [ ] Cocina (@{viewer.id}:Viewer:pending)",
            "unit": "servicio",
            "location_id": location.id,
        },
    ).json()

    response = client.patch(
        f"/api/v1/task-items/{created['id']}/checklist-items/{created['checklist_items'][0]['id']}",
        headers=_headers(manager),
        json={"completed": True},
    )

    assert response.status_code == 200, response.text
    assert response.json()["checklist_items"][0]["completed"] is True


def test_invalid_description_update_keeps_existing_structure(client, db):
    company = _company(db, "AtomicStructure")
    foreign = _company(db, "AtomicForeign")
    admin = _user(db, company, "admin@atomic-structure.test", 1)
    viewer = _user(db, company, "viewer@atomic-structure.test", 3)
    foreign_viewer = _user(db, foreign, "viewer@atomic-foreign.test", 3)
    location = _location(db, company)
    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Atomic update",
            "description": f"- [ ] Cocina (@{viewer.id}:Viewer:pending)",
            "unit": "servicio",
            "location_id": location.id,
        },
    ).json()

    response = client.patch(
        f"/api/v1/task-items/{created['id']}",
        headers=_headers(admin),
        json={
            "description": f"- [ ] Intruso (@{foreign_viewer.id}:Foreign:pending)"
        },
    )

    assert response.status_code == 400
    task = db.get(TaskItem, created["id"])
    db.refresh(task)
    assert task.description == f"- [ ] Cocina (@{viewer.id}:Viewer:pending)"
    assert [item.text for item in task.checklist_items] == ["Cocina"]
    assert [assignment.user_id for assignment in task.assignments] == [viewer.id]


def test_deleting_task_cascades_structured_rows(client, db):
    company = _company(db, "DeleteStructure")
    admin = _user(db, company, "admin@delete-structure.test", 1)
    viewer = _user(db, company, "viewer@delete-structure.test", 3)
    location = _location(db, company)
    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Delete structure",
            "description": f"- [ ] Cocina (@{viewer.id}:Viewer:pending)",
            "unit": "servicio",
            "location_id": location.id,
        },
    ).json()

    response = client.delete(
        f"/api/v1/task-items/{created['id']}",
        headers=_headers(admin),
    )

    assert response.status_code == 204
    assert db.query(TaskChecklistItem).count() == 0
    assert db.query(TaskChecklistAssignment).count() == 0
    assert db.query(TaskAssignment).count() == 0


def test_checklist_answer_payload_rejects_inconsistent_state(client, db):
    company = _company(db, "PayloadStructure")
    admin = _user(db, company, "admin@payload-structure.test", 1)
    viewer = _user(db, company, "viewer@payload-structure.test", 3)
    location = _location(db, company)
    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Payload validation",
            "description": f"- [ ] Cocina (@{viewer.id}:Viewer:pending)",
            "unit": "servicio",
            "location_id": location.id,
        },
    ).json()

    response = client.patch(
        f"/api/v1/task-items/{created['id']}/checklist-items/{created['checklist_items'][0]['id']}",
        headers=_headers(viewer),
        json={"completed": False, "answer": "yes"},
    )

    assert response.status_code == 422
    assert db.get(TaskChecklistItem, created["checklist_items"][0]["id"]).completed is False


def test_all_worker_assignment_can_update_shared_structured_item(client, db):
    company = _company(db, "AllWorkerStructure")
    admin = _user(db, company, "admin@all-worker-structure.test", 1)
    viewer = _user(db, company, "viewer@all-worker-structure.test", 3)
    location = _location(db, company)
    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Shared item",
            "description": (
                f"<!-- workhive_assignees:{viewer.id} -->\n"
                "- [ ] Cocina compartida"
            ),
            "unit": "servicio",
            "location_id": location.id,
        },
    ).json()

    response = client.patch(
        f"/api/v1/task-items/{created['id']}/checklist-items/{created['checklist_items'][0]['id']}",
        headers=_headers(viewer),
        json={"completed": True},
    )

    assert response.status_code == 200, response.text
    assert response.json()["assignments"][0]["status"] == "completed"


def test_explicit_worker_cannot_update_unassigned_structured_item(client, db):
    company = _company(db, "MixedStructure")
    admin = _user(db, company, "admin@mixed-structure.test", 1)
    viewer = _user(db, company, "viewer@mixed-structure.test", 3)
    location = _location(db, company)
    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Mixed items",
            "description": (
                f"- [ ] Cocina (@{viewer.id}:Viewer:pending)\n"
                "- [ ] Administración"
            ),
            "unit": "servicio",
            "location_id": location.id,
        },
    ).json()

    response = client.patch(
        f"/api/v1/task-items/{created['id']}/checklist-items/{created['checklist_items'][1]['id']}",
        headers=_headers(viewer),
        json={"completed": True},
    )

    assert response.status_code == 403
