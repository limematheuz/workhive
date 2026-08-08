from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models.task_item import TaskItem
from app.models.work_session import WorkSession
from app.schemas.invoice import InvoiceDraftCreate
from app.schemas.invoice_item import InvoiceItemCreate
from app.schemas.task_item import TaskItemUpdate
from app.services import invoice_service, task_billing_service, task_item_service
from tests.test_reservations import _company, _location, _user


def _hourly_task_with_sessions(db, *, seconds_by_user: list[int]) -> tuple:
    company = _company(db, "Ownet Billing", "OWNETBILL")
    admin = _user(db, company, role_id=1, email="billing-admin@ownet.test")
    location = _location(db, company)
    workers = [
        _user(db, company, role_id=3, email=f"worker{i}@ownet.test")
        for i in range(len(seconds_by_user))
    ]

    task = TaskItem(
        title="Limpieza por horas",
        description="",
        price=20.0,
        quantity=1,
        unit="hour",
        pricing_mode="hourly",
        status="progress",
        company_id=company.id,
        location_id=location.id,
        user_id=workers[0].id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    start = datetime(2026, 8, 8, 8, 0, tzinfo=timezone.utc)
    for worker, seconds in zip(workers, seconds_by_user):
        db.add(
            WorkSession(
                user_id=worker.id,
                location_id=location.id,
                task_item_id=task.id,
                start_time=start,
                end_time=start + timedelta(seconds=seconds),
                start_latitude=42.1,
                start_longitude=3.1,
            )
        )
    db.commit()
    return company, admin, task


def test_completion_freezes_person_hours_snapshot(db):
    company, admin, task = _hourly_task_with_sessions(
        db,
        seconds_by_user=[40 * 60, 60 * 60, 30 * 60, 20 * 60],
    )

    updated = task_item_service.update_task_item(
        db,
        admin,
        task.id,
        TaskItemUpdate(status="completed"),
    )

    assert updated.status == "completed"
    assert updated.worked_seconds_snapshot == 2 * 3600 + 30 * 60
    assert task_billing_service.billable_hours_from_seconds(
        updated.worked_seconds_snapshot
    ) == Decimal("2.5000")


def test_hourly_invoice_uses_snapshot_hours_times_rate(db):
    company, admin, task = _hourly_task_with_sessions(
        db,
        seconds_by_user=[3600, 3600, 3600, 3600],
    )
    task_item_service.update_task_item(
        db,
        admin,
        task.id,
        TaskItemUpdate(status="completed"),
    )
    db.refresh(task)

    client_id = task.location.client_id
    assert client_id is not None

    billable = invoice_service.get_invoiceable_completed_tasks(db, company.id)
    assert len(billable) == 1
    assert billable[0].worked_seconds == 4 * 3600
    assert billable[0].worked_hours == 4.0
    assert billable[0].pricing_mode == "hourly"
    assert len(billable[0].workers) == 4
    assert sum(worker.worked_seconds for worker in billable[0].workers) == 4 * 3600

    invoice = invoice_service.create_invoice_draft(
        db,
        company.id,
        InvoiceDraftCreate(
            client_id=client_id,
            issue_date=datetime.now(timezone.utc),
            items=[
                InvoiceItemCreate(
                    description="should be overridden economically",
                    quantity=1,
                    unit_price=999,
                    tax_rate=0.21,
                    task_item_id=task.id,
                )
            ],
        ),
    )

    assert len(invoice.items) == 1
    item = invoice.items[0]
    assert float(item.quantity) == 4.0
    assert float(item.unit_price) == 20.0
    assert float(item.subtotal) == 80.0


def test_fixed_price_tasks_still_expose_person_hours_for_invoicing(db):
    company, admin, task = _hourly_task_with_sessions(
        db,
        seconds_by_user=[40 * 60, 60 * 60, 30 * 60, 20 * 60],
    )
    task.pricing_mode = "fixed"
    task.price = 165.0
    task.quantity = 1
    task.unit = "service"
    db.add(task)
    db.commit()

    task_item_service.update_task_item(
        db,
        admin,
        task.id,
        TaskItemUpdate(status="completed"),
    )

    billable = invoice_service.get_invoiceable_completed_tasks(db, company.id)
    assert len(billable) == 1
    assert billable[0].pricing_mode == "fixed"
    assert billable[0].worked_seconds == 2 * 3600 + 30 * 60
    assert len(billable[0].workers) == 4
    assert sum(worker.worked_seconds for worker in billable[0].workers) == (
        2 * 3600 + 30 * 60
    )


def test_fixed_price_tasks_ignore_hours_for_invoice_amount(db):
    company, admin, task = _hourly_task_with_sessions(
        db,
        seconds_by_user=[3600, 3600],
    )
    task.pricing_mode = "fixed"
    task.price = 165.0
    task.quantity = 1
    task.unit = "service"
    db.add(task)
    db.commit()

    task_item_service.update_task_item(
        db,
        admin,
        task.id,
        TaskItemUpdate(status="completed"),
    )
    db.refresh(task)

    client_id = task.location.client_id
    assert client_id is not None

    invoice = invoice_service.create_invoice_draft(
        db,
        company.id,
        InvoiceDraftCreate(
            client_id=client_id,
            issue_date=datetime.now(timezone.utc),
            items=[
                InvoiceItemCreate(
                    description="fixed",
                    quantity=99,
                    unit_price=1,
                    tax_rate=0.21,
                    task_item_id=task.id,
                )
            ],
        ),
    )
    item = invoice.items[0]
    assert float(item.quantity) == 1.0
    assert float(item.unit_price) == 165.0
