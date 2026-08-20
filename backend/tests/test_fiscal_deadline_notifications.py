from datetime import date

from app.core.config import settings
from app.models.company import Company
from app.models.company_fiscal_settings import CompanyFiscalSettings
from app.models.notification import Notification
from app.models.user import User
from app.services import fiscal_deadline_notification_service


def _company(db, name: str, *, active: bool = True) -> Company:
    company = Company(
        name=name,
        tax_id=f"{name.upper()}-FISCAL",
        address="Calle Fiscal 1",
        phone="600000000",
        email=f"{name.lower()}@fiscal.test",
        is_active=active,
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    return company


def _user(
    db,
    company: Company,
    email: str,
    role_id: int,
    *,
    active: bool = True,
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


def _fiscal_settings(
    db,
    company: Company,
    *,
    vat: bool = True,
    withholding: bool = False,
    reminder_days: int = 7,
) -> CompanyFiscalSettings:
    fiscal_settings = CompanyFiscalSettings(
        company_id=company.id,
        quarterly_vat_enabled=vat,
        quarterly_withholding_enabled=withholding,
        fiscal_reminder_days=reminder_days,
    )
    db.add(fiscal_settings)
    db.commit()
    return fiscal_settings


def test_fiscal_deadline_reminders_notify_active_admins_once_per_deadline(db):
    company = _company(db, "Fiscal reminders")
    admin = _user(db, company, "admin@fiscal-reminders.test", 1)
    _user(db, company, "manager@fiscal-reminders.test", 2)
    _user(db, company, "inactive@fiscal-reminders.test", 1, active=False)
    _fiscal_settings(db, company, vat=True, withholding=True, reminder_days=7)

    # Seven days before the Q3 deadline: both configured models are due.
    today = date(2026, 10, 13)
    assert fiscal_deadline_notification_service.send_fiscal_deadline_notifications(
        db, today=today
    ) == 2

    notifications = sorted(
        db.query(Notification).all(), key=lambda item: item.metadata_json["model"]
    )
    assert [(item.user_id, item.event_type) for item in notifications] == [
        (admin.id, "fiscal.deadline_due_soon"),
        (admin.id, "fiscal.deadline_due_soon"),
    ]
    assert [item.metadata_json["model"] for item in notifications] == ["111", "303"]
    assert all(item.href == "/dashboard/fiscal-calendar" for item in notifications)
    assert fiscal_deadline_notification_service.send_fiscal_deadline_notifications(
        db, today=today
    ) == 0


def test_fiscal_deadline_reminders_include_prior_year_t4_and_respect_global_disable(
    db, monkeypatch
):
    company = _company(db, "January fiscal reminders")
    admin = _user(db, company, "admin@january-fiscal.test", 1)
    fiscal_settings = _fiscal_settings(db, company, vat=True, reminder_days=7)
    today = date(2027, 1, 23)

    deadlines = fiscal_deadline_notification_service.fiscal_deadlines_due_this_calendar_year(
        fiscal_settings,
        today=today,
    )
    assert [(deadline.model, deadline.tax_period, deadline.due_date) for deadline in deadlines] == [
        ("303", "T4 2026", date(2027, 1, 30)),
        ("303", "T1 2027", date(2027, 4, 20)),
        ("303", "T2 2027", date(2027, 7, 20)),
        ("303", "T3 2027", date(2027, 10, 20)),
    ]
    assert fiscal_deadline_notification_service.send_fiscal_deadline_notifications(
        db, today=today
    ) == 1
    assert db.query(Notification).filter(Notification.user_id == admin.id).count() == 1

    monkeypatch.setattr(
        settings, "FISCAL_CALENDAR_REMINDERS_ENABLED", False
    )
    assert fiscal_deadline_notification_service.send_fiscal_deadline_notifications(
        db, today=today
    ) == 0
