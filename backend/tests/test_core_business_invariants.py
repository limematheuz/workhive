from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select

from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.client import Client
from app.models.company_collaboration import CompanyCollaboration
from app.models.location_company_access import LocationCompanyAccess
from app.models.notification import Notification
from app.models.quote import Quote
from app.models.quote_item import QuoteItem
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.repositories import invoice_item as invoice_item_repo
from app.repositories import quote_item as quote_item_repo
from app.schemas.invoice import InvoiceDraftCreate, InvoiceUpdate
from app.schemas.invoice_item import InvoiceItemCreate
from app.schemas.quote import QuoteCreate, QuoteUpdate
from app.schemas.quote_item import QuoteItemCreate
from app.schemas.reservation import ReservationUpdate
from app.schemas.task_item import TaskItemCreate, TaskItemUpdate
from app.services import (
    invoice_service,
    quote_service,
    reservation_service,
    task_item_service,
)
from tests.test_reservations import _company, _location, _reservation_data, _user


def _quote_items(*descriptions: str) -> list[QuoteItemCreate]:
    return [
        QuoteItemCreate(description=description, quantity=index, unit_price=25)
        for index, description in enumerate(descriptions, start=1)
    ]


def _task(db, *, completed: bool, client_suffix: str = ""):
    company = _company(db, f"Billing {client_suffix}", f"BILLING{client_suffix}")
    admin = _user(
        db,
        company,
        role_id=1,
        email=f"admin-{client_suffix.lower()}@billing.test",
    )
    location = _location(db, company)
    task = task_item_service.create_task_item(
        db,
        admin,
        TaskItemCreate(
            title="Servicio facturable",
            description="- [ ] Trabajo pendiente",
            price=100,
            quantity=1,
            unit="servicio",
            location_id=location.id,
        ),
    )
    if completed:
        task.checklist_items[0].completed = True
        task.status = "completed"
        task.date_done = datetime.now(timezone.utc)
        db.add(task)
        db.commit()
        db.refresh(task)
    return company, admin, location, task


def _draft_for_task(task: TaskItem, client_id: int) -> InvoiceDraftCreate:
    return InvoiceDraftCreate(
        client_id=client_id,
        issue_date=datetime.now(timezone.utc),
        items=[
            InvoiceItemCreate(
                description=task.title,
                quantity=1,
                unit_price=task.price or 0,
                tax_rate=0.21,
                task_item_id=task.id,
            )
        ],
    )


def _other_client(db, company, suffix: str) -> Client:
    client = Client(
        name=f"Otro cliente {suffix}",
        legal_number=f"OTHER-{company.id}-{suffix}",
        address="Calle Alternativa 2",
        city="Girona",
        postal_code="17002",
        country="España",
        company_id=company.id,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def test_quote_create_persists_header_items_and_totals_in_one_operation(db):
    company = _company(db, "Atomic quotes", "ATOMICQUOTES")

    quote = quote_service.create_quote(
        db,
        company.id,
        QuoteCreate(
            title="Servicio completo",
            tax_rate=0.21,
            items=_quote_items("Limpieza", "Lavandería"),
        ),
    )

    assert [item.description for item in quote.items] == ["Limpieza", "Lavandería"]
    assert quote.base_amount == 75
    assert quote.tax_amount == 15.75
    assert quote.total_amount == 90.75


def test_quote_create_rolls_back_header_when_any_item_fails(db, monkeypatch):
    company = _company(db, "Rollback quote", "ROLLBACKQUOTE")
    original_create = quote_item_repo.create_quote_item
    calls = 0

    def fail_second_item(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("simulated item failure")
        return original_create(*args, **kwargs)

    monkeypatch.setattr(quote_item_repo, "create_quote_item", fail_second_item)

    with pytest.raises(RuntimeError, match="simulated item failure"):
        quote_service.create_quote(
            db,
            company.id,
            QuoteCreate(
                title="No debe quedar a medias",
                items=_quote_items("Primera", "Segunda"),
            ),
        )

    assert db.query(Quote).filter(Quote.company_id == company.id).count() == 0
    assert db.query(QuoteItem).count() == 0


def test_quote_update_replaces_the_draft_item_snapshot_atomically(db):
    company = _company(db, "Update quote", "UPDATEQUOTE")
    quote = quote_service.create_quote(
        db,
        company.id,
        QuoteCreate(title="Original", items=_quote_items("Antiguo", "Eliminar")),
    )

    updated = quote_service.update_quote(
        db,
        company.id,
        quote.id,
        QuoteUpdate(
            title="Actualizado",
            items=[
                QuoteItemCreate(
                    description="Única línea vigente",
                    quantity=2,
                    unit_price=40,
                )
            ],
        ),
    )

    assert updated.title == "Actualizado"
    assert [item.description for item in updated.items] == ["Única línea vigente"]
    assert updated.base_amount == 80


def test_incomplete_task_cannot_be_invoiced(db):
    company, _, location, task = _task(db, completed=False, client_suffix="OPEN")

    with pytest.raises(HTTPException) as exc_info:
        invoice_service.create_invoice_draft(
            db,
            company.id,
            _draft_for_task(task, location.client_id),
        )

    assert exc_info.value.status_code == 409
    assert "completed" in str(exc_info.value.detail).lower()
    db.refresh(task)
    assert task.is_invoiced is False
    assert db.query(Invoice).filter(Invoice.company_id == company.id).count() == 0


def test_task_can_only_be_invoiced_to_its_resolved_billing_client(db):
    company, _, location, task = _task(db, completed=True, client_suffix="CLIENT")
    other_client = _other_client(db, company, "invoice")

    with pytest.raises(HTTPException) as exc_info:
        invoice_service.create_invoice_draft(
            db,
            company.id,
            _draft_for_task(task, other_client.id),
        )

    assert exc_info.value.status_code == 409
    assert "client" in str(exc_info.value.detail).lower()
    assert location.client_id != other_client.id
    db.refresh(task)
    assert task.is_invoiced is False


def test_draft_client_cannot_change_away_from_its_linked_task_client(db):
    company, _, location, task = _task(db, completed=True, client_suffix="EDIT")
    other_client = _other_client(db, company, "edit")
    invoice = invoice_service.create_invoice_draft(
        db,
        company.id,
        _draft_for_task(task, location.client_id),
    )

    with pytest.raises(HTTPException) as exc_info:
        invoice_service.update_invoice(
            db,
            company.id,
            invoice.id,
            InvoiceUpdate(client_id=other_client.id),
        )

    assert exc_info.value.status_code == 409
    db.refresh(invoice)
    assert invoice.client_id == location.client_id


def test_invoice_update_replaces_draft_items_and_task_links_atomically(db):
    company, _, location, task = _task(
        db,
        completed=True,
        client_suffix="INVOICEUPDATE",
    )
    invoice = invoice_service.create_invoice_draft(
        db,
        company.id,
        _draft_for_task(task, location.client_id),
    )

    updated = invoice_service.update_invoice(
        db,
        company.id,
        invoice.id,
        InvoiceUpdate(
            notes="Borrador actualizado",
            items=[
                InvoiceItemCreate(
                    description="Servicio manual vigente",
                    quantity=2,
                    unit_price=40,
                    tax_rate=0.21,
                )
            ],
        ),
    )

    assert updated.notes == "Borrador actualizado"
    assert [item.description for item in updated.items] == [
        "Servicio manual vigente"
    ]
    assert updated.base_amount == 80
    assert updated.tax_amount == Decimal("16.80")
    assert updated.total_amount == Decimal("96.80")
    db.refresh(task)
    assert task.is_invoiced is False


def test_invoice_update_rolls_back_header_items_and_task_links_on_failure(
    db,
    monkeypatch,
):
    company, _, location, task = _task(
        db,
        completed=True,
        client_suffix="INVOICEROLLBACK",
    )
    invoice = invoice_service.create_invoice_draft(
        db,
        company.id,
        _draft_for_task(task, location.client_id),
    )
    original_number = invoice.invoice_number
    original_create = invoice_item_repo.create_invoice_item
    calls = 0

    def fail_second_item(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("simulated invoice item failure")
        return original_create(*args, **kwargs)

    monkeypatch.setattr(
        invoice_item_repo,
        "create_invoice_item",
        fail_second_item,
    )

    with pytest.raises(RuntimeError, match="simulated invoice item failure"):
        invoice_service.update_invoice(
            db,
            company.id,
            invoice.id,
            InvoiceUpdate(
                notes="No debe persistir",
                items=[
                    InvoiceItemCreate(
                        description="Primera línea temporal",
                        quantity=1,
                        unit_price=25,
                    ),
                    InvoiceItemCreate(
                        description="Segunda línea fallida",
                        quantity=1,
                        unit_price=30,
                    ),
                ],
            ),
        )

    db.expire_all()
    persisted = db.get(Invoice, invoice.id)
    assert persisted is not None
    assert persisted.invoice_number == original_number
    assert persisted.notes is None
    persisted_task_ids = db.scalars(
        select(InvoiceItem.task_item_id).where(
            InvoiceItem.invoice_id == invoice.id
        )
    ).all()
    assert persisted_task_ids == [task.id]
    assert db.query(InvoiceItem).filter_by(invoice_id=invoice.id).count() == 1
    persisted_task = db.get(TaskItem, task.id)
    assert persisted_task is not None
    assert persisted_task.is_invoiced is True


def test_task_status_contract_rejects_unknown_values():
    with pytest.raises(ValidationError):
        TaskItemUpdate(status="finished_somehow")


def test_task_with_pending_checklist_cannot_be_forced_to_completed(db):
    company, admin, _, task = _task(db, completed=False, client_suffix="CHECKLIST")

    with pytest.raises(HTTPException) as exc_info:
        task_item_service.update_task_item(
            db,
            admin,
            task.id,
            TaskItemUpdate(status="completed"),
        )

    assert exc_info.value.status_code == 409
    assert "checklist" in str(exc_info.value.detail).lower()
    db.refresh(task)
    assert task.status == "pending"
    assert company.id == task.company_id


def test_reservation_creation_rolls_back_if_task_generation_fails(db, monkeypatch):
    company = _company(db, "Atomic reservation", "ATOMICRESERVATION")
    admin = _user(
        db,
        company,
        role_id=1,
        email="admin@atomic-reservation.test",
    )
    location = _location(db, company)

    def fail_task_generation(*args, **kwargs):
        raise RuntimeError("simulated task generation failure")

    monkeypatch.setattr(
        reservation_service,
        "sync_checkout_task",
        fail_task_generation,
    )

    with pytest.raises(RuntimeError, match="simulated task generation failure"):
        reservation_service.create_reservation(
            db,
            admin,
            _reservation_data(location.id),
        )

    assert (
        db.query(Reservation)
        .filter(Reservation.location_id == location.id)
        .count()
        == 0
    )
    assert (
        db.query(TaskItem)
        .filter(TaskItem.location_id == location.id)
        .count()
        == 0
    )


def test_reservation_update_rolls_back_if_task_generation_fails(db, monkeypatch):
    company = _company(db, "Atomic reservation update", "ATOMICRESUPDATE")
    admin = _user(
        db,
        company,
        role_id=1,
        email="admin@atomic-reservation-update.test",
    )
    location = _location(db, company)
    create_data = _reservation_data(location.id).model_copy(
        update={"cleaning_required": False}
    )
    reservation = reservation_service.create_reservation(db, admin, create_data)

    def fail_task_generation(*args, **kwargs):
        raise RuntimeError("simulated task generation failure")

    monkeypatch.setattr(
        reservation_service,
        "sync_checkout_task",
        fail_task_generation,
    )

    with pytest.raises(RuntimeError, match="simulated task generation failure"):
        reservation_service.update_reservation(
            db,
            admin,
            reservation.id,
            ReservationUpdate(cleaning_required=True),
        )

    db.expire_all()
    persisted = db.get(Reservation, reservation.id)
    assert persisted is not None
    assert persisted.cleaning_required is False
    assert (
        db.query(TaskItem)
        .filter(TaskItem.checkout_reservation_id == reservation.id)
        .count()
        == 0
    )


def test_external_reservation_rolls_back_access_client_and_task_if_notification_fails(
    db,
    monkeypatch,
):
    issuer = _company(db, "Atomic external issuer", "ATOMICEXTISSUER")
    receiver = _company(db, "Atomic external receiver", "ATOMICEXTRECEIVER")
    issuer_admin = _user(
        db,
        issuer,
        role_id=1,
        email="admin@atomic-external-issuer.test",
    )
    _user(
        db,
        receiver,
        role_id=1,
        email="admin@atomic-external-receiver.test",
    )
    location = _location(db, issuer)
    db.add(
        CompanyCollaboration(
            initiator_company_id=issuer.id,
            partner_company_id=receiver.id,
            status="accepted",
            role_type="service_provider",
        )
    )
    db.commit()
    receiver_client_count = (
        db.query(Client).filter(Client.company_id == receiver.id).count()
    )

    def fail_notification(*args, **kwargs):
        raise RuntimeError("simulated notification failure")

    monkeypatch.setattr(
        reservation_service.task_lifecycle_notification_service,
        "notify_request_sent",
        fail_notification,
    )

    with pytest.raises(RuntimeError, match="simulated notification failure"):
        reservation_service.create_reservation(
            db,
            issuer_admin,
            _reservation_data(location.id).model_copy(
                update={"assigned_company_id": receiver.id}
            ),
        )

    assert db.query(Reservation).count() == 0
    assert db.query(TaskItem).count() == 0
    assert (
        db.query(LocationCompanyAccess)
        .filter(
            LocationCompanyAccess.location_id == location.id,
            LocationCompanyAccess.company_id == receiver.id,
        )
        .count()
        == 0
    )
    assert (
        db.query(Client).filter(Client.company_id == receiver.id).count()
        == receiver_client_count
    )
    assert db.query(Notification).count() == 0


def test_invoiced_reservation_cannot_be_cancelled_or_deleted(db):
    company = _company(db, "Protected reservation", "PROTECTEDRES")
    admin = _user(
        db,
        company,
        role_id=1,
        email="admin@protected-reservation.test",
    )
    location = _location(db, company)
    reservation = reservation_service.create_reservation(
        db,
        admin,
        _reservation_data(location.id),
    )
    task = reservation.checkout_tasks[0]
    task.status = "completed"
    task.date_done = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    invoice_service.create_invoice_draft(
        db,
        company.id,
        _draft_for_task(task, location.client_id),
    )

    with pytest.raises(HTTPException) as cancel_error:
        reservation_service.update_reservation(
            db,
            admin,
            reservation.id,
            ReservationUpdate(status="cancelled"),
        )
    assert cancel_error.value.status_code == 409

    with pytest.raises(HTTPException) as delete_error:
        reservation_service.delete_reservation(db, admin, reservation.id)
    assert delete_error.value.status_code == 409

    db.expire_all()
    persisted = db.get(Reservation, reservation.id)
    assert persisted is not None
    assert persisted.status != "cancelled"
    persisted_task = db.get(TaskItem, task.id)
    assert persisted_task is not None
    assert persisted_task.is_invoiced is True
