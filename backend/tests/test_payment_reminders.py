from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models.client import Client
from app.models.company import Company
from app.models.invoice import Invoice
from app.models.notification import Notification
from app.models.user import User
from app.services import payment_reminder_service


def _company(db, name: str, *, active: bool = True) -> Company:
    company = Company(
        name=name,
        tax_id=f"{name.upper()}-PAYMENT",
        address="Calle Cobros 1",
        phone="600000000",
        email=f"{name.lower()}@payment.test",
        is_active=active,
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    return company


def _user(
    db, company: Company, email: str, role_id: int, *, active: bool = True
) -> User:
    user = User(
        company_id=company.id,
        email=email,
        hashed_password="unused",
        full_name=email.partition("@")[0],
        role_id=role_id,
        is_active=active,
    )
    db.add(user)
    db.commit()
    return user


def _invoice(
    db,
    company: Company,
    *,
    number: str,
    due_date: datetime | None,
    invoice_status: str = "issued",
    active: bool = True,
) -> Invoice:
    client = Client(
        company_id=company.id,
        name=f"Cliente {number}",
        address="Calle Cliente 1",
        city="Girona",
        postal_code="17001",
        country="España",
    )
    invoice = Invoice(
        company_id=company.id,
        client=client,
        invoice_number=number,
        issue_date=datetime(2026, 8, 1, tzinfo=timezone.utc),
        due_date=due_date,
        status=invoice_status,
        base_amount=Decimal("100.00"),
        tax_amount=Decimal("21.00"),
        total_amount=Decimal("121.00"),
        is_active=active,
    )
    db.add(invoice)
    db.commit()
    return invoice


def test_payment_reminders_alert_only_active_company_admins_and_deduplicate(db):
    now = datetime(2026, 8, 10, 9, tzinfo=timezone.utc)
    company = _company(db, "Cobros")
    admin = _user(db, company, "admin@payment.test", 1)
    _user(db, company, "manager@payment.test", 2)
    _user(db, company, "inactive-admin@payment.test", 1, active=False)
    due_soon = _invoice(
        db,
        company,
        number="INV-2026-0010",
        due_date=now + timedelta(days=3),
    )
    overdue = _invoice(
        db,
        company,
        number="INV-2026-0009",
        due_date=now - timedelta(days=1),
    )
    _invoice(db, company, number="INV-2026-PAID", due_date=now, invoice_status="paid")
    _invoice(db, company, number="INV-2026-NO-DUE", due_date=None)

    assert payment_reminder_service.send_due_payment_notifications(db, now=now) == 2
    notifications = db.query(Notification).order_by(Notification.entity_id).all()
    assert [
        (item.user_id, item.event_type, item.entity_id) for item in notifications
    ] == [
        (admin.id, "invoice.payment_due_soon", due_soon.id),
        (admin.id, "invoice.payment_overdue", overdue.id),
    ]
    assert all(
        item.href == f"/dashboard/invoices/{item.entity_id}" for item in notifications
    )
    assert payment_reminder_service.send_due_payment_notifications(db, now=now) == 0
    assert db.query(Notification).count() == 2


def test_payment_reminders_skip_inactive_companies_and_can_be_disabled(db, monkeypatch):
    now = datetime(2026, 8, 10, 9, tzinfo=timezone.utc)
    inactive_company = _company(db, "Inactiva", active=False)
    _user(db, inactive_company, "admin-inactiva@payment.test", 1)
    _invoice(
        db,
        inactive_company,
        number="INV-2026-INACTIVE",
        due_date=now - timedelta(days=1),
    )

    assert payment_reminder_service.send_due_payment_notifications(db, now=now) == 0
    assert db.query(Notification).count() == 0

    monkeypatch.setattr(
        payment_reminder_service.settings, "PAYMENT_REMINDERS_ENABLED", False
    )
    active_company = _company(db, "Activa")
    _user(db, active_company, "admin-activa@payment.test", 1)
    _invoice(
        db,
        active_company,
        number="INV-2026-DISABLED",
        due_date=now - timedelta(days=1),
    )
    assert payment_reminder_service.send_due_payment_notifications(db, now=now) == 0
    assert db.query(Notification).count() == 0
