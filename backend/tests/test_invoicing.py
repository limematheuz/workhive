from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.client import Client
from app.models.location_company_access import LocationCompanyAccess
from app.models.location_template import LocationTemplate
from app.models.invoice import Invoice
from app.models.task_item import TaskItem
from app.models.template_task import TemplateTask
from app.schemas.invoice import InvoiceDraftCreate, InvoiceUpdate
from app.schemas.invoice_item import InvoiceItemCreate
from app.schemas.task_item import (
    TaskAcceptRequest,
    TaskChecklistItemUpdate,
    TaskItemUpdate,
)
from app.services import (
    invoice_service,
    company_service,
    reservation_tasks,
    reservation_service,
    task_assignment_service,
    task_item_service,
)
from tests.test_reservations import _company, _location, _reservation_data, _user


def _external_completed_task_setup(
    db,
    *,
    complete: bool = True,
    accept: bool = True,
):
    issuer = _company(db, "Port Blanc", "PORTBLANC")
    receiver = _company(db, "Ownet Limpiezas", "OWNET")
    location = _location(db, issuer)
    issuer_admin = _user(db, issuer, role_id=1, email="admin@portblanc.test")
    receiver_admin = _user(db, receiver, role_id=1, email="admin@ownet.test")
    _user(db, receiver, role_id=3, email="worker@ownet.test")

    db.add(
        LocationCompanyAccess(
            location_id=location.id,
            company_id=receiver.id,
            relationship_type="service_provider",
            can_manage_reservations=True,
            can_manage_tasks=True,
        )
    )
    template = TemplateTask(
        name="Limpieza salida",
        description="- [ ] Cambiar sábanas\n- [ ] Preparar toallas",
        default_price=145.0,
        unit="servicio",
        company_id=issuer.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    db.add(
        LocationTemplate(
            location_id=location.id,
            template_task_id=template.id,
        )
    )
    db.commit()

    data = _reservation_data(location.id)
    data.assigned_company_id = receiver.id
    reservation_service.create_reservation(db, issuer_admin, data)

    task = (
        db.query(TaskItem)
        .filter(TaskItem.checkout_reservation_id.isnot(None))
        .order_by(TaskItem.id.desc())
        .first()
    )
    assert task is not None
    assert task.status == "requested"

    if not accept:
        return issuer, receiver, receiver_admin, task

    task_item_service.accept_task_item(
        db,
        receiver_admin,
        task.id,
        TaskAcceptRequest(),
    )
    db.refresh(task)
    assert task.status == "accepted"

    if not complete:
        return issuer, receiver, receiver_admin, task

    completed = task
    for checklist_item in list(task.checklist_items):
        completed = task_item_service.update_task_checklist_item(
            db,
            receiver_admin,
            task.id,
            checklist_item.id,
            TaskChecklistItemUpdate(completed=True, answer="yes"),
        )
    assert completed.status == "completed"
    return issuer, receiver, receiver_admin, task


def test_external_completed_task_is_invoiceable_for_receiver(db):
    issuer, receiver, receiver_admin, task = _external_completed_task_setup(db)

    billable = invoice_service.get_invoiceable_completed_tasks(db, receiver.id)

    assert len(billable) == 1
    assert billable[0].id == task.id
    assert billable[0].billing_source == "external"
    assert billable[0].client_name == issuer.name
    assert billable[0].collaborator_company_id == issuer.id
    assert billable[0].collaborator_company_name == issuer.name

    # The collaborator must survive the request/session transaction and remain
    # available to the invoice form as a real client.
    db.rollback()
    issuer_client = (
        db.query(Client)
        .filter(Client.company_id == receiver.id, Client.name == issuer.name)
        .first()
    )
    assert issuer_client is not None
    assert issuer_client.legal_number == issuer.tax_id
    assert billable[0].client_id == issuer_client.id

    issuer_admin = (
        db.query(type(receiver_admin))
        .filter(type(receiver_admin).company_id == issuer.id)
        .first()
    )
    expenses = company_service.get_company_expenses(
        db,
        issuer.id,
        issuer_admin,
    )
    assert len(expenses) == 1
    assert expenses[0].task_id == task.id
    assert expenses[0].amount == 145.0
    assert expenses[0].provider_company_id == receiver.id


def test_external_receiver_can_configure_hourly_task_billing(db):
    _, _, receiver_admin, task = _external_completed_task_setup(db, complete=False)

    updated = task_item_service.update_task_item(
        db,
        receiver_admin,
        task.id,
        TaskItemUpdate(
            pricing_mode="hourly",
            price=25,
            quantity=1,
            unit="hour",
        ),
    )

    assert updated.pricing_mode == "hourly"
    assert updated.price == 25
    assert updated.unit == "hour"

    started = task_item_service.update_task_item(
        db,
        receiver_admin,
        task.id,
        TaskItemUpdate(status="progress"),
    )
    assert started.pricing_locked_at is not None
    assert started.billing_pricing_mode_snapshot == "hourly"
    assert started.billing_price_snapshot == 25

    with pytest.raises(HTTPException) as error:
        task_item_service.update_task_item(
            db,
            receiver_admin,
            task.id,
            TaskItemUpdate(price=30),
        )

    assert error.value.status_code == 409


def test_external_receiver_confirms_hourly_terms_when_accepting(db):
    _, _, receiver_admin, task = _external_completed_task_setup(
        db,
        complete=False,
        accept=False,
    )

    task.price = None
    task.quantity = None
    task.unit = "servicio"
    db.commit()

    accepted = task_item_service.accept_task_item(
        db,
        receiver_admin,
        task.id,
        TaskAcceptRequest(
            pricing_mode="hourly",
            price=25,
            quantity=1,
            unit="servicio",
        ),
    )

    assert accepted.status == "accepted"
    assert accepted.pricing_mode == "hourly"
    assert accepted.price == 25
    assert accepted.quantity == 1
    assert accepted.unit == "hour"


def test_external_task_without_agreed_price_cannot_be_accepted(db):
    issuer, _, receiver_admin, task = _external_completed_task_setup(
        db,
        complete=False,
        accept=False,
    )
    template = (
        db.query(TemplateTask)
        .filter(TemplateTask.company_id == issuer.id)
        .one()
    )
    template.default_price = None
    task.price = None
    task.quantity = None
    db.commit()

    with pytest.raises(HTTPException) as error:
        task_item_service.accept_task_item(
            db,
            receiver_admin,
            task.id,
            TaskAcceptRequest(pricing_mode="fixed", quantity=1, unit="service"),
        )

    assert error.value.status_code == 409
    assert "agreed task price" in error.value.detail
    db.refresh(task)
    assert task.status == "requested"


def test_reservation_resync_cannot_replace_started_receiver_terms(db):
    issuer, receiver, receiver_admin, task = _external_completed_task_setup(
        db,
        complete=False,
    )
    task_item_service.update_task_item(
        db,
        receiver_admin,
        task.id,
        TaskItemUpdate(pricing_mode="hourly", price=25, quantity=1, unit="hour"),
    )
    task_item_service.update_task_item(
        db,
        receiver_admin,
        task.id,
        TaskItemUpdate(status="progress"),
    )
    db.refresh(task)
    assert task.billing_price_snapshot == 25

    template = (
        db.query(TemplateTask)
        .filter(TemplateTask.company_id == issuer.id)
        .one()
    )
    template.default_price = 999
    db.commit()

    reservation = task.checkout_reservation
    assert reservation is not None
    resynced = reservation_tasks.sync_checkout_task(
        db,
        reservation,
        task.location,
        receiver.id,
        reservation.check_out_at,
        reservation.guest_count,
        reservation.cleaning_scheduled_at,
    )

    assert resynced is not None
    assert resynced.pricing_mode == "hourly"
    assert resynced.price == 25
    assert resynced.billing_price_snapshot == 25


def test_reservation_resync_cannot_reassign_started_task_to_another_provider(db):
    issuer, receiver, receiver_admin, task = _external_completed_task_setup(
        db,
        complete=False,
    )
    task_item_service.update_task_item(
        db,
        receiver_admin,
        task.id,
        TaskItemUpdate(pricing_mode="hourly", price=25, quantity=1, unit="hour"),
    )
    task_item_service.update_task_item(
        db,
        receiver_admin,
        task.id,
        TaskItemUpdate(status="progress"),
    )

    replacement_provider = _company(db, "Replacement Provider", "REPLACEMENT")
    db.add(
        LocationCompanyAccess(
            location_id=task.location_id,
            company_id=replacement_provider.id,
            relationship_type="service_provider",
            can_manage_reservations=True,
            can_manage_tasks=True,
        )
    )
    db.commit()

    reservation = task.checkout_reservation
    assert reservation is not None
    with pytest.raises(HTTPException) as error:
        reservation_tasks.sync_checkout_task(
            db,
            reservation,
            task.location,
            replacement_provider.id,
            reservation.check_out_at,
            reservation.guest_count,
            reservation.cleaning_scheduled_at,
        )

    assert error.value.status_code == 409
    db.refresh(task)
    assert task.company_id == receiver.id


def test_external_completed_task_creates_persistent_invoice_lines_and_totals(db):
    issuer, receiver, _, task = _external_completed_task_setup(db)
    receiver.default_payment_notes = "Transferencia bancaria a 15 días"
    receiver.default_document_terms = "Servicio sujeto a condiciones acordadas"
    db.add(receiver)
    db.commit()

    [billable] = invoice_service.get_invoiceable_completed_tasks(db, receiver.id)
    draft = invoice_service.create_invoice_draft(
        db,
        receiver.id,
        InvoiceDraftCreate(
            client_id=billable.client_id,
            issue_date=datetime.now(timezone.utc),
            notes=receiver.default_payment_notes,
            terms=receiver.default_document_terms,
            items=[
                InvoiceItemCreate(
                    description=(
                        f"{billable.title}\n"
                        f"{billable.location_name}"
                    ),
                    quantity=billable.quantity or 1,
                    unit_price=billable.price or 0,
                    tax_rate=0.21,
                    task_item_id=billable.id,
                )
            ],
        ),
    )

    db.refresh(task)
    assert draft.client.name == issuer.name
    assert draft.client.legal_number == issuer.tax_id
    assert len(draft.items) == 1
    assert draft.items[0].task_item_id == task.id
    assert draft.items[0].unit_price == Decimal("145.0000")
    assert draft.items[0].quantity == Decimal("1.0000")
    assert draft.items[0].subtotal == Decimal("145.00")
    assert draft.items[0].total == Decimal("175.45")
    assert draft.base_amount == Decimal("145.00")
    assert draft.tax_amount == Decimal("30.45")
    assert draft.total_amount == Decimal("175.45")
    assert draft.notes == receiver.default_payment_notes
    assert draft.terms == receiver.default_document_terms
    assert task.is_invoiced is True


def test_viewer_sees_accepted_external_task_in_company_pool(db):
    issuer = _company(db, "Emisor", "EMISOR")
    receiver = _company(db, "Receptor", "RECEPTOR")
    location = _location(db, issuer)
    issuer_admin = _user(db, issuer, role_id=1, email="admin@emisor.test")
    receiver_admin = _user(db, receiver, role_id=1, email="admin@receptor.test")
    receiver_worker = _user(db, receiver, role_id=3, email="viewer@receptor.test")

    db.add(
        LocationCompanyAccess(
            location_id=location.id,
            company_id=receiver.id,
            relationship_type="service_provider",
            can_manage_reservations=True,
            can_manage_tasks=True,
        )
    )
    db.commit()

    data = _reservation_data(location.id)
    data.assigned_company_id = receiver.id
    reservation_service.create_reservation(db, issuer_admin, data)

    task = db.query(TaskItem).filter(TaskItem.status == "requested").first()
    assert task is not None

    task_item_service.accept_task_item(
        db,
        receiver_admin,
        task.id,
        TaskAcceptRequest(price=145, quantity=1, unit="service"),
    )
    db.refresh(task)
    assert task.status == "accepted"

    company_tasks = task_item_service.get_task_items(db, receiver.id)
    worker_visible = [
        item
        for item in company_tasks
        if item.status in task_assignment_service.OPERATIONAL_VIEWER_STATUSES
        and task_assignment_service.can_viewer_access_task(item, receiver_worker.id)
    ]
    assert [item.id for item in worker_visible] == [task.id]
    assert task_assignment_service.can_viewer_access_task(task, receiver_worker.id)


def test_marking_invoice_paid_directly_is_rejected(db):
    company = _company(db, "Cobros", "COBROS")
    client = Client(
        name="Cliente cobrado",
        email="cliente-cobrado@example.com",
        legal_number="CLIENTE-COBRADO",
        address="Calle Uno",
        city="Madrid",
        postal_code="28001",
        country="España",
        phone="600000000",
        company_id=company.id,
    )
    db.add(client)
    db.flush()
    invoice = Invoice(
        invoice_number="INV-2026-PAID",
        issue_date=datetime.now(timezone.utc) - timedelta(days=30),
        status="issued",
        company_id=company.id,
        client_id=client.id,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    with pytest.raises(HTTPException) as error:
        invoice_service.update_invoice(
            db,
            company.id,
            invoice.id,
            InvoiceUpdate(status="paid"),
        )

    assert error.value.status_code == 400
    assert "customer payment" in error.value.detail.lower()
    db.refresh(invoice)
    assert invoice.status == "issued"
    assert invoice.paid_at is None
