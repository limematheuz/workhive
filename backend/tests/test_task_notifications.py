from datetime import datetime, timedelta, timezone

from app.core.security import create_access_token
from app.models.company import Company
from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess
from app.models.notification import Notification
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.models.user import User
from app.models.work_session import WorkSession
from app.services import task_assignment_service


def _company(db, name: str) -> Company:
    company = Company(
        name=name,
        tax_id=f"{name.upper()}-NOTIFY",
        address="Notification Street 1",
        phone="600000000",
        email=f"{name.lower()}@notify.test",
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


def _external_task(db):
    owner = _company(db, "NotifyOwner")
    receiver = _company(db, "NotifyReceiver")
    unrelated = _company(db, "NotifyUnrelated")
    owner_admin = _user(db, owner, "owner-admin@notify.test", 1)
    owner_emitter = _user(db, owner, "owner-emitter@notify.test", 2)
    receiver_admin = _user(db, receiver, "receiver-admin@notify.test", 1)
    second_receiver_admin = _user(db, receiver, "receiver-admin-2@notify.test", 1)
    receiver_manager = _user(db, receiver, "receiver-manager@notify.test", 2)
    receiver_viewer = _user(db, receiver, "receiver-viewer@notify.test", 3)
    second_receiver_viewer = _user(db, receiver, "receiver-viewer-2@notify.test", 3)
    unrelated_admin = _user(db, unrelated, "unrelated-admin@notify.test", 1)
    location = Location(
        name="Casa Notificaciones",
        address="Notification Street 2",
        city="Girona",
        owner_company_id=owner.id,
        managing_company_id=owner.id,
    )
    db.add(location)
    db.commit()
    reservation = Reservation(
        location_id=location.id,
        owner_company_id=owner.id,
        assigned_company_id=receiver.id,
        created_by_user_id=owner_emitter.id,
        check_in_at=datetime.now(timezone.utc),
        check_out_at=datetime.now(timezone.utc) + timedelta(days=2),
        guest_count=2,
    )
    db.add(reservation)
    db.commit()
    task = TaskItem(
        title="Limpieza externa notificada",
        description="- [ ] Cocina\n- [ ] Baño",
        unit="servicio",
        company_id=receiver.id,
        location_id=location.id,
        checkout_reservation_id=reservation.id,
        user_id=receiver_admin.id,
        status="requested",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {
        "task": task,
        "owner_admin": owner_admin,
        "owner_emitter": owner_emitter,
        "receiver_admin": receiver_admin,
        "second_receiver_admin": second_receiver_admin,
        "receiver_manager": receiver_manager,
        "receiver_viewer": receiver_viewer,
        "second_receiver_viewer": second_receiver_viewer,
        "unrelated_admin": unrelated_admin,
    }


def test_external_task_reaches_emitter_and_every_active_receiver_role(client, db):
    users = _external_task(db)
    task = users["task"]

    pending_for_second_admin = client.get(
        "/api/v1/task-items/?task_status=requested",
        headers=_headers(users["second_receiver_admin"]),
    )
    assert pending_for_second_admin.status_code == 200
    assert task.id in {item["id"] for item in pending_for_second_admin.json()}

    accepted = client.post(
        f"/api/v1/task-items/{task.id}/accept",
        headers=_headers(users["receiver_admin"]),
        json={},
    )
    assert accepted.status_code == 200, accepted.text

    for key in (
        "receiver_admin",
        "second_receiver_admin",
        "receiver_manager",
        "receiver_viewer",
        "second_receiver_viewer",
    ):
        response = client.get("/api/v1/task-items/", headers=_headers(users[key]))
        assert response.status_code == 200
        assert task.id in {item["id"] for item in response.json()}
        assert task_assignment_service.is_user_assigned(db.get(TaskItem, task.id), users[key].id)

    assignment_notifications = db.query(Notification).filter(
        Notification.event_type == "task.assigned"
    ).all()
    assert {item.user_id for item in assignment_notifications} == {
        users[key].id
        for key in (
            "receiver_admin",
            "second_receiver_admin",
            "receiver_manager",
            "receiver_viewer",
            "second_receiver_viewer",
        )
    }

    owner_read = client.get(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(users["owner_admin"]),
    )
    assert owner_read.status_code == 200
    assert client.get(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(users["owner_emitter"]),
    ).status_code == 200
    assert client.patch(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(users["owner_admin"]),
        json={"title": "Cross-tenant overwrite"},
    ).status_code == 404
    assert client.delete(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(users["owner_admin"]),
    ).status_code == 404
    assert db.get(TaskItem, task.id).title == "Limpieza externa notificada"
    assert client.get(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(users["unrelated_admin"]),
    ).status_code == 404


def test_worker_cannot_rewrite_legacy_report_arrays(client, db):
    users = _external_task(db)
    task = users["task"]
    assert client.post(
        f"/api/v1/task-items/{task.id}/accept",
        headers=_headers(users["receiver_admin"]),
        json={},
    ).status_code == 200

    report = {
        "id": "issue-1",
        "type": "mantenimiento",
        "element": "lavabo",
        "title": "Fuga de agua",
        "description": "Pierde agua",
        "photoUrl": "/uploads/issue.jpg",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    update = client.patch(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(users["receiver_viewer"]),
        json={
            "reported_issues": [report],
            "attachments": [{"url": "/uploads/work.jpg", "date": report["createdAt"]}],
            "operational_notes": [{"author": "worker", "text": "Revisar fuga", "date": report["createdAt"]}],
        },
    )
    assert update.status_code == 403, update.text
    db.refresh(task)
    assert task.reported_issues == []
    assert task.attachments == []
    assert task.operational_notes == []
    assert db.query(Notification).filter(
        Notification.event_type == "task.reported"
    ).count() == 0


def test_notification_api_is_user_scoped_and_marks_only_owned_notification(client, db):
    users = _external_task(db)
    owned = Notification(
        user_id=users["receiver_admin"].id,
        company_id=users["receiver_admin"].company_id,
        event_type="task.assigned",
        title="Nueva tarea",
        message="Tarea asignada",
        entity_type="task_item",
        entity_id=users["task"].id,
        href=f"/dashboard?taskId={users['task'].id}",
    )
    foreign = Notification(
        user_id=users["unrelated_admin"].id,
        company_id=users["unrelated_admin"].company_id,
        event_type="task.assigned",
        title="Otra tarea",
        message="No visible",
        entity_type="task_item",
        entity_id=999,
        href="/dashboard?taskId=999",
    )
    second_owned = Notification(
        user_id=users["receiver_admin"].id,
        company_id=users["receiver_admin"].company_id,
        event_type="task.reported",
        title="Nuevo reporte",
        message="Tarea asignada",
        entity_type="task_item",
        entity_id=users["task"].id,
        href=f"/dashboard?taskId={users['task'].id}",
    )
    db.add_all([owned, second_owned, foreign])
    db.commit()
    db.refresh(owned)
    db.refresh(foreign)

    listed = client.get("/api/v1/notifications/", headers=_headers(users["receiver_admin"]))
    assert listed.status_code == 200
    assert {item["id"] for item in listed.json()} == {owned.id, second_owned.id}

    assert client.patch(
        f"/api/v1/notifications/{foreign.id}/read",
        headers=_headers(users["receiver_admin"]),
    ).status_code == 404
    marked = client.patch(
        f"/api/v1/notifications/{owned.id}/read",
        headers=_headers(users["receiver_admin"]),
    )
    assert marked.status_code == 200
    assert marked.json()["read_at"] is not None

    clear_all = client.patch(
        "/api/v1/notifications/read-all",
        headers=_headers(users["receiver_admin"]),
    )
    assert clear_all.status_code == 204
    assert client.get(
        "/api/v1/notifications/",
        headers=_headers(users["receiver_admin"]),
    ).json() == []
    db.refresh(foreign)
    assert foreign.read_at is None


def test_opening_task_acknowledges_all_of_its_unread_events_for_current_user(client, db):
    users = _external_task(db)
    task = users["task"]
    recipient = users["receiver_admin"]
    other_recipient = users["second_receiver_admin"]
    first = Notification(
        user_id=recipient.id,
        company_id=recipient.company_id,
        event_type="task.assigned",
        title="Nueva tarea",
        message="Asignada",
        entity_type="task_item",
        entity_id=task.id,
        href=f"/dashboard?taskId={task.id}",
    )
    second = Notification(
        user_id=recipient.id,
        company_id=recipient.company_id,
        event_type="task.reported",
        title="Nuevo reporte",
        message="Reporte recibido",
        entity_type="task_item",
        entity_id=task.id,
        href=f"/dashboard?taskId={task.id}",
    )
    foreign = Notification(
        user_id=other_recipient.id,
        company_id=other_recipient.company_id,
        event_type="task.assigned",
        title="Nueva tarea",
        message="Asignada",
        entity_type="task_item",
        entity_id=task.id,
        href=f"/dashboard?taskId={task.id}",
    )
    unrelated = Notification(
        user_id=recipient.id,
        company_id=recipient.company_id,
        event_type="task.assigned",
        title="Otra tarea",
        message="Debe continuar pendiente",
        entity_type="task_item",
        entity_id=task.id + 1,
        href=f"/dashboard?taskId={task.id + 1}",
    )
    db.add_all([first, second, foreign, unrelated])
    db.commit()

    response = client.patch(
        f"/api/v1/notifications/task-items/{task.id}/read",
        headers=_headers(recipient),
    )
    assert response.status_code == 204, response.text

    db.refresh(first)
    db.refresh(second)
    db.refresh(foreign)
    db.refresh(unrelated)
    assert first.read_at is not None
    assert second.read_at is not None
    assert foreign.read_at is None
    assert unrelated.read_at is None


def test_location_operational_history_is_period_scoped_and_tenant_safe(client, db):
    users = _external_task(db)
    task = users["task"]
    # Wednesday keeps both sessions in the same Monday-based calendar week.
    # Using the real date made this assertion fail every Monday.
    now = datetime(2026, 8, 12, 12, 0, tzinfo=timezone.utc)
    task.status = "completed"
    task.date_done = now - timedelta(hours=1)
    db.add(LocationCompanyAccess(
        location_id=task.location_id,
        company_id=users["receiver_admin"].company_id,
        relationship_type="service_provider",
        can_manage_tasks=True,
    ))
    db.add_all([
        WorkSession(
            user_id=users["receiver_admin"].id,
            location_id=task.location_id,
            task_item_id=task.id,
            start_time=now - timedelta(hours=3),
            end_time=now - timedelta(hours=2),
        ),
        WorkSession(
            user_id=users["receiver_admin"].id,
            location_id=task.location_id,
            task_item_id=task.id,
            start_time=now - timedelta(days=2, hours=3),
            end_time=now - timedelta(days=2, hours=2),
        ),
    ])
    db.commit()

    day = now.date().isoformat()
    issuer_history = client.get(
        f"/api/v1/locations/{task.location_id}/operational-history?period=day&anchor_date={day}",
        headers=_headers(users["owner_admin"]),
    )
    assert issuer_history.status_code == 200, issuer_history.text
    payload = issuer_history.json()
    assert payload["period"] == "day"
    assert payload["completed_task_count"] == 1
    assert [item["id"] for item in payload["completed_tasks"]] == [task.id]
    assert payload["worked_seconds"] == 3600
    assert [item["task_item_id"] for item in payload["sessions"]] == [task.id]

    provider_history = client.get(
        f"/api/v1/locations/{task.location_id}/operational-history?period=week&anchor_date={day}",
        headers=_headers(users["receiver_admin"]),
    )
    assert provider_history.status_code == 200, provider_history.text
    assert provider_history.json()["completed_task_count"] == 1
    assert provider_history.json()["worked_seconds"] == 7200

    forbidden = client.get(
        f"/api/v1/locations/{task.location_id}/operational-history?period=month&anchor_date={day}",
        headers=_headers(users["unrelated_admin"]),
    )
    assert forbidden.status_code == 404


def test_location_operational_history_paginates_completed_tasks_and_sessions(client, db):
    users = _external_task(db)
    first_task = users["task"]
    now = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)
    first_task.status = "completed"
    first_task.date_done = now - timedelta(hours=1)
    second_task = TaskItem(
        title="Segunda limpieza terminada",
        description="- [ ] Revisar terraza",
        unit="servicio",
        company_id=users["receiver_admin"].company_id,
        location_id=first_task.location_id,
        checkout_reservation_id=first_task.checkout_reservation_id,
        user_id=users["receiver_admin"].id,
        status="completed",
        date_done=now - timedelta(hours=2),
    )
    db.add(second_task)
    db.flush()
    db.add_all([
        WorkSession(
            user_id=users["receiver_admin"].id,
            location_id=first_task.location_id,
            task_item_id=first_task.id,
            start_time=now - timedelta(hours=3),
            end_time=now - timedelta(hours=2),
        ),
        WorkSession(
            user_id=users["receiver_admin"].id,
            location_id=first_task.location_id,
            task_item_id=second_task.id,
            start_time=now - timedelta(hours=2),
            end_time=now - timedelta(hours=1),
        ),
    ])
    db.commit()

    history = client.get(
        f"/api/v1/locations/{first_task.location_id}/operational-history"
        f"?period=day&anchor_date={now.date().isoformat()}&limit=1",
        headers=_headers(users["owner_admin"]),
    )
    assert history.status_code == 200, history.text
    payload = history.json()
    assert payload["completed_task_count"] == 2
    assert payload["completed_task_total"] == 2
    assert payload["session_total"] == 2
    assert payload["worked_seconds"] == 7200
    assert len(payload["completed_tasks"]) == 1
    assert len(payload["sessions"]) == 1

    second_page = client.get(
        f"/api/v1/locations/{first_task.location_id}/operational-history"
        f"?period=day&anchor_date={now.date().isoformat()}&limit=1"
        "&completed_offset=1&sessions_offset=1",
        headers=_headers(users["owner_admin"]),
    )
    assert second_page.status_code == 200, second_page.text
    assert second_page.json()["completed_tasks"][0]["id"] != payload["completed_tasks"][0]["id"]
    assert second_page.json()["sessions"][0]["id"] != payload["sessions"][0]["id"]


def test_task_report_payload_size_is_bounded_before_persistence(client, db):
    users = _external_task(db)
    task = users["task"]
    assert client.post(
        f"/api/v1/task-items/{task.id}/accept",
        headers=_headers(users["receiver_admin"]),
        json={},
    ).status_code == 200

    oversized = client.patch(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(users["receiver_viewer"]),
        json={"operational_notes": [{"text": "x" * (257 * 1024)}]},
    )

    assert oversized.status_code == 422
    assert db.get(TaskItem, task.id).operational_notes == []
    assert db.query(Notification).filter(
        Notification.event_type == "task.reported"
    ).count() == 0


def test_assigned_viewer_receives_pending_internal_task_and_can_start_after_activation(client, db):
    company = _company(db, "VictoriaDelivery")
    admin = _user(db, company, "admin@victoria.test", 1)
    victoria = _user(db, company, "victoria@victoria.test", 3)
    other_viewer = _user(db, company, "other@victoria.test", 3)
    location = Location(
        name="Casa Victoria",
        address="Calle Victoria 1",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    db.refresh(location)

    db.add_all([
        TaskItem(
            title=f"Ruido {index}",
            description="- [ ] Sin asignar",
            unit="servicio",
            company_id=company.id,
            location_id=location.id,
            status="accepted",
        )
        for index in range(105)
    ])
    db.commit()

    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Tarea de Victoria",
            "description": f"- [ ] Limpiar cocina (@{victoria.id}:Victoria)",
            "unit": "servicio",
            "location_id": location.id,
        },
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]
    assert created.json()["status"] == "pending"

    first_page = client.get(
        "/api/v1/task-items/?skip=0&limit=100",
        headers=_headers(victoria),
    )
    assert first_page.status_code == 200, first_page.text
    assert [item["id"] for item in first_page.json()] == [task_id]
    assert client.get(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(victoria),
    ).status_code == 200
    assert task_id not in {
        item["id"]
        for item in client.get(
            "/api/v1/task-items/", headers=_headers(other_viewer)
        ).json()
    }

    notifications = client.get(
        "/api/v1/notifications/", headers=_headers(victoria)
    )
    assert notifications.status_code == 200
    assert [item["entity_id"] for item in notifications.json()] == [task_id]
    assert notifications.json()[0]["event_type"] == "task.assigned"
    assert client.get(
        "/api/v1/notifications/", headers=_headers(other_viewer)
    ).json() == []

    blocked = client.post(
        f"/api/v1/task-items/{task_id}/start-work",
        headers=_headers(victoria),
        json={
            "start_latitude": 40.4168,
            "start_longitude": -3.7038,
            "start_accuracy_meters": 10,
        },
    )
    assert blocked.status_code == 400, blocked.text

    activated = client.patch(
        f"/api/v1/task-items/{task_id}",
        headers=_headers(admin),
        json={"status": "progress"},
    )
    assert activated.status_code == 200, activated.text

    started = client.post(
        f"/api/v1/task-items/{task_id}/start-work",
        headers=_headers(victoria),
        json={
            "start_latitude": 40.4168,
            "start_longitude": -3.7038,
            "start_accuracy_meters": 10,
        },
    )
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "progress"


def test_new_line_assignment_notifies_only_new_same_company_viewer_once(client, db):
    company = _company(db, "LineAssignment")
    admin = _user(db, company, "admin@line-assignment.test", 1)
    victoria = _user(db, company, "victoria@line-assignment.test", 3)
    foreign_company = _company(db, "ForeignAssignment")
    foreign_viewer = _user(db, foreign_company, "foreign@line-assignment.test", 3)
    location = Location(
        name="Casa asignaciones",
        address="Calle Linea 1",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    task = TaskItem(
        title="Asignación posterior",
        description="- [ ] Limpiar cocina",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        status="pending",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    assigned_description = (
        f"- [ ] Limpiar cocina (@{victoria.id}:Victoria)\n"
        f"- [ ] ID externo inválido (@{foreign_viewer.id}:Foreign)"
    )
    assigned = client.patch(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(admin),
        json={"description": assigned_description},
    )
    assert assigned.status_code == 400, assigned.text
    assert db.query(Notification).filter(
        Notification.entity_type == "task_item",
        Notification.entity_id == task.id,
        Notification.event_type == "task.assigned",
    ).count() == 0

    valid_description = f"- [ ] Limpiar cocina (@{victoria.id}:Victoria)"
    assigned = client.patch(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(admin),
        json={"description": valid_description},
    )
    assert assigned.status_code == 200, assigned.text
    repeated = client.patch(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(admin),
        json={"description": valid_description},
    )
    assert repeated.status_code == 200, repeated.text

    notifications = db.query(Notification).filter(
        Notification.entity_type == "task_item",
        Notification.entity_id == task.id,
        Notification.event_type == "task.assigned",
    ).all()
    assert [item.user_id for item in notifications] == [victoria.id]
    assert task.id in {
        item["id"]
        for item in client.get(
            "/api/v1/task-items/", headers=_headers(victoria)
        ).json()
    }
    assert client.get(
        f"/api/v1/task-items/{task.id}",
        headers=_headers(foreign_viewer),
    ).status_code == 404
