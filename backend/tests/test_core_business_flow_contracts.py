from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.security import create_access_token
from app.models.client import Client
from app.models.company_collaboration import CompanyCollaboration
from app.models.location_company_access import LocationCompanyAccess
from app.models.location_template import LocationTemplate
from app.models.notification import Notification
from app.models.task_item import TaskItem
from app.models.task_structure import TaskAssignment
from app.models.template_task import TemplateTask
from app.models.user import User
from app.models.work_session import WorkSession
from app.schemas.invoice import InvoiceDraftCreate
from app.schemas.invoice_item import InvoiceItemCreate
from app.schemas.reservation import ReservationCreate
from app.schemas.task_item import (
    TaskAcceptRequest,
    TaskChecklistItemUpdate,
    TaskItemCreate,
    TaskItemUpdate,
)
from app.schemas.template_task import TemplateTaskUpdate
from app.services import (
    client_service,
    invoice_service,
    reservation_service,
    task_item_service,
    template_task_service,
    work_session_service,
)
from tests.test_reservations import _company, _location, _user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return {"Authorization": f"Bearer {token}"}


def _future_reservation(
    location_id: int,
    *,
    assigned_company_id: int | None = None,
) -> ReservationCreate:
    check_in_at = datetime.now(timezone.utc) + timedelta(days=3)
    return ReservationCreate(
        location_id=location_id,
        check_in_at=check_in_at,
        check_out_at=check_in_at + timedelta(days=2),
        guest_count=2,
        cleaning_required=True,
        assigned_company_id=assigned_company_id,
    )


def _notification_events(db, user: User) -> list[str]:
    return [
        notification.event_type
        for notification in (
            db.query(Notification)
            .filter(Notification.user_id == user.id)
            .order_by(Notification.id)
            .all()
        )
    ]


def _complete_assigned_item(db, task: TaskItem, worker: User) -> None:
    checklist_item = next(
        item
        for item in task.checklist_items
        if any(assignment.user_id == worker.id for assignment in item.assignments)
    )
    task_item_service.start_task_work(
        db,
        worker,
        task.id,
        start_latitude=41.3851,
        start_longitude=2.1734,
        start_accuracy_meters=5,
    )
    task_item_service.update_task_checklist_item(
        db,
        worker,
        task.id,
        checklist_item.id,
        TaskChecklistItemUpdate(completed=True, answer="yes"),
    )
    task_item_service.finish_task_work(db, worker, task.id)


def _create_invoice_for_task(db, company_id: int, task: TaskItem):
    [billable] = invoice_service.get_invoiceable_completed_tasks(db, company_id)
    invoice = invoice_service.create_invoice_draft(
        db,
        company_id,
        InvoiceDraftCreate(
            client_id=billable.client_id,
            issue_date=datetime.now(timezone.utc),
            items=[
                InvoiceItemCreate(
                    description=billable.title,
                    quantity=billable.quantity or 1,
                    unit_price=billable.price or 0,
                    tax_rate=0.21,
                    task_item_id=task.id,
                )
            ],
        ),
    )
    db.refresh(task)
    return invoice


def test_task_list_is_read_only_and_never_completes_work(client, db):
    company = _company(db, "Read only tasks", "READONLYTASK")
    company.subscription_plan = "pro"
    company.subscription_status = "active"
    db.add(company)
    db.commit()
    admin = _user(db, company, role_id=1, email="admin@readonly-task.test")
    location = _location(db, company)
    task = task_item_service.create_task_item(
        db,
        admin,
        TaskItemCreate(
            title="No completar al consultar",
            description=f"- [ ] Revisar cierre (@{admin.id}:Admin:progress)",
            unit="servicio",
            location_id=location.id,
            user_id=admin.id,
        ),
    )
    task.status = "progress"
    task.checklist_items[0].completed = True
    session = WorkSession(
        user_id=admin.id,
        location_id=location.id,
        task_item_id=task.id,
        start_time=datetime.now(timezone.utc) - timedelta(minutes=15),
        start_latitude=41.3851,
        start_longitude=2.1734,
    )
    db.add_all([task, session])
    db.commit()

    response = client.get("/api/v1/task-items/", headers=_headers(admin))

    assert response.status_code == 200, response.text
    db.refresh(task)
    db.refresh(session)
    assert task.status == "progress"
    assert task.date_done is None
    assert session.end_time is None


def test_client_and_invoiceable_queries_never_materialize_collaborators(db):
    issuer = _company(db, "Read only issuer", "READONLYISSUER")
    receiver = _company(db, "Read only receiver", "READONLYRECEIVER")
    location = _location(db, issuer)
    db.add(
        CompanyCollaboration(
            initiator_company_id=issuer.id,
            partner_company_id=receiver.id,
            status="accepted",
            role_type="service_provider",
        )
    )
    task = TaskItem(
        title="Trabajo histórico sin cliente sincronizado",
        description="- [x] Finalizado",
        price=50,
        quantity=1,
        unit="servicio",
        status="completed",
        company_id=receiver.id,
        location_id=location.id,
        service_context="checkout",
        date_done=datetime.now(timezone.utc),
    )
    db.add(task)
    db.commit()
    initial_client_count = db.query(Client).count()

    client_service.get_clients(db, receiver.id)
    invoice_service.get_invoiceable_completed_tasks(db, receiver.id)
    db.rollback()

    assert db.query(Client).count() == initial_client_count


def test_template_edit_does_not_rewrite_an_existing_task_snapshot(db):
    company = _company(db, "Snapshot company", "SNAPSHOT")
    admin = _user(db, company, role_id=1, email="admin@snapshot.test")
    location = _location(db, company)
    template = TemplateTask(
        name="Plantilla global",
        description="- [ ] Alcance contratado",
        default_price=90,
        unit="servicio",
        company_id=company.id,
    )
    db.add(template)
    db.commit()
    task = task_item_service.create_task_item(
        db,
        admin,
        TaskItemCreate(
            title="Trabajo creado desde plantilla",
            description=template.description,
            price=template.default_price,
            quantity=1,
            unit=template.unit,
            template_task_id=template.id,
            location_id=location.id,
            user_id=admin.id,
        ),
    )

    template_task_service.update_template_task(
        db,
        template.id,
        TemplateTaskUpdate(description="- [ ] Alcance nuevo"),
        company.id,
    )

    db.refresh(task)
    assert task.description == "- [ ] Alcance contratado"
    assert [item.text for item in task.checklist_items] == ["Alcance contratado"]


def test_assigned_worker_can_read_linked_reservation_via_relational_assignment(db):
    company = _company(db, "Reservation assignment", "RESASSIGN")
    admin = _user(db, company, role_id=1, email="admin@reservation-assignment.test")
    viewer = _user(db, company, role_id=3, email="viewer@reservation-assignment.test")
    location = _location(db, company)
    reservation = reservation_service.create_reservation(
        db,
        admin,
        _future_reservation(location.id),
    )
    task = reservation.checkout_tasks[0]
    task.user_id = admin.id
    db.add(
        TaskAssignment(
            task_id=task.id,
            user_id=viewer.id,
            status="accepted",
            source="direct",
        )
    )
    db.commit()

    resolved = reservation_service.get_reservation(db, viewer, reservation.id)

    assert resolved.id == reservation.id


def test_own_company_flow_runs_from_template_to_invoice_for_every_role(db):
    company = _company(db, "Internal operations", "INTERNALOPS")
    admin = _user(db, company, role_id=1, email="admin@internal-ops.test")
    manager = _user(db, company, role_id=2, email="manager@internal-ops.test")
    viewer = _user(db, company, role_id=3, email="viewer@internal-ops.test")
    location = _location(db, company)
    description = (
        f"- [ ] Abrir servicio (@{admin.id}:Admin:accepted)\n"
        f"- [ ] Supervisar servicio (@{manager.id}:Manager:accepted)\n"
        f"- [ ] Ejecutar limpieza (@{viewer.id}:Viewer:accepted)"
    )
    template = TemplateTask(
        name="Servicio global reutilizable",
        description=description,
        default_price=180,
        unit="servicio",
        company_id=company.id,
    )
    db.add(template)
    db.commit()
    db.add(LocationTemplate(location_id=location.id, template_task_id=template.id))
    db.commit()
    task = task_item_service.create_task_item(
        db,
        admin,
        TaskItemCreate(
            title="Primera tarea de la ubicación",
            description=description,
            price=180,
            quantity=1,
            unit="servicio",
            template_task_id=template.id,
            location_id=location.id,
        ),
    )
    assert task.status == "pending"
    task_item_service.update_task_item(
        db,
        admin,
        task.id,
        TaskItemUpdate(status="progress"),
    )

    for worker in (admin, manager, viewer):
        visible_ids = {
            item.id
            for item in task_item_service.get_task_items(
                db,
                company.id,
                user_id=worker.id,
            )
        }
        assert task.id in visible_ids
        _complete_assigned_item(db, task, worker)
        db.refresh(task)

    assert task.status == "completed"
    assert task.date_done is not None
    assert all(item.completed for item in task.checklist_items)
    work_summary = work_session_service.get_task_work_summary(db, admin, task.id)
    assert work_summary.session_count == 3
    assert work_summary.active_workers == 0

    invoice = _create_invoice_for_task(db, company.id, task)

    assert invoice.status == "draft"
    assert invoice.items[0].task_item_id == task.id
    assert task.is_invoiced is True


def test_external_reservation_flow_notifies_both_companies_and_reaches_every_role(db):
    issuer = _company(db, "Property issuer", "PROPERTYISSUER")
    receiver = _company(db, "Cleaning receiver", "CLEANRECEIVER")
    issuer_admin = _user(db, issuer, role_id=1, email="admin@property-issuer.test")
    receiver_admin = _user(db, receiver, role_id=1, email="admin@cleaning-receiver.test")
    receiver_manager = _user(db, receiver, role_id=2, email="manager@cleaning-receiver.test")
    receiver_viewer = _user(db, receiver, role_id=3, email="viewer@cleaning-receiver.test")
    location = _location(db, issuer)
    db.add_all(
        [
            CompanyCollaboration(
                initiator_company_id=issuer.id,
                partner_company_id=receiver.id,
                status="accepted",
                role_type="service_provider",
            ),
            LocationCompanyAccess(
                location_id=location.id,
                company_id=receiver.id,
                relationship_type="service_provider",
                can_manage_reservations=False,
                can_manage_tasks=True,
                can_view_sensitive=True,
            ),
        ]
    )
    template = TemplateTask(
        name="Salida global",
        description="- [ ] Apertura\n- [ ] Supervisión\n- [ ] Limpieza",
        default_price=220,
        unit="servicio",
        company_id=issuer.id,
    )
    db.add(template)
    db.commit()
    db.add(LocationTemplate(location_id=location.id, template_task_id=template.id))
    db.commit()

    reservation = reservation_service.create_reservation(
        db,
        issuer_admin,
        _future_reservation(location.id, assigned_company_id=receiver.id),
    )
    task = reservation.checkout_tasks[0]

    assert reservation.service_request_sent_at is not None
    assert task.status == "requested"
    assert "task.requested" in _notification_events(db, receiver_admin)
    assert "task.requested" in _notification_events(db, receiver_manager)
    assert "task.requested" not in _notification_events(db, receiver_viewer)

    task_item_service.accept_task_item(db, receiver_admin, task.id, TaskAcceptRequest())
    db.refresh(task)

    assert task.status == "accepted"
    assert {assignment.user_id for assignment in task.assignments} == {
        receiver_admin.id,
        receiver_manager.id,
        receiver_viewer.id,
    }
    assert "task.request.accepted" in _notification_events(db, issuer_admin)
    for worker in (receiver_admin, receiver_manager, receiver_viewer):
        assert "task.assigned" in _notification_events(db, worker)

    assigned_description = (
        f"- [ ] Apertura (@{receiver_admin.id}:Admin:accepted)\n"
        f"- [ ] Supervisión (@{receiver_manager.id}:Manager:accepted)\n"
        f"- [ ] Limpieza (@{receiver_viewer.id}:Viewer:accepted)"
    )
    task_item_service.update_task_item(
        db,
        receiver_admin,
        task.id,
        TaskItemUpdate(description=assigned_description),
    )
    db.refresh(task)

    for worker in (receiver_admin, receiver_manager, receiver_viewer):
        _complete_assigned_item(db, task, worker)
        db.refresh(task)

    assert task.status == "completed"
    assert "task.work.started" in _notification_events(db, issuer_admin)
    assert "task.completed" in _notification_events(db, issuer_admin)
    issuer_view = reservation_service.build_reservation_response(
        db,
        reservation,
        issuer_admin,
    )
    assert issuer_view.cleaning_status == "completed"
    assert len(issuer_view.cleaning_start_locations) == 3

    invoice = _create_invoice_for_task(db, receiver.id, task)

    assert invoice.client.name == issuer.name
    assert invoice.items[0].task_item_id == task.id
    assert task.is_invoiced is True
