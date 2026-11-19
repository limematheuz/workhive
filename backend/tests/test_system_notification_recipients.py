from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.models.client import Client
from app.models.company import Company
from app.models.company_fiscal_settings import CompanyFiscalSettings
from app.models.company_membership import CompanyMembership
from app.models.invoice import Invoice
from app.models.notification import Notification
from app.models.role import Role
from app.models.staff_employee import StaffEmployee
from app.models.user import User
from app.services import (
    calendar_governance_service,
    fiscal_deadline_notification_service,
    operations_automation_service,
    payment_reminder_service,
    trial_expiry_notification_service,
)
from app.services.company_notification_recipients import recipients as company_recipients
from app.services.organization_membership_lifecycle import sync_administrator_profile
from app.models.operations_automation import OperationsAutomation


def _role_id(db, name: str) -> int:
    return db.query(Role).filter(Role.name == name).one().id


def _company(db, slug: str, **kwargs) -> Company:
    defaults = {
        "name": f"SysNotif {slug}",
        "tax_id": f"SN-{slug.upper()}",
        "address": "Calle Prueba 1",
        "phone": "600000000",
        "email": f"{slug}@sysnotif.test",
        "is_active": True,
        "subscription_plan": "mega",
        "subscription_status": "active",
    }
    defaults.update(kwargs)
    company = Company(**defaults)
    db.add(company)
    db.flush()
    return company


def _user(db, company: Company, email: str, role_name: str, *, active: bool = True) -> User:
    user = User(
        company_id=company.id,
        email=email,
        hashed_password="unused",
        full_name=email.partition("@")[0],
        role_id=_role_id(db, role_name),
        is_active=active,
    )
    db.add(user)
    db.flush()
    return user


def _membership(
    db,
    company: Company,
    user: User,
    access_class: str,
    *,
    status: str = "active",
    permissions_configured: bool = True,
) -> CompanyMembership:
    membership = CompanyMembership(
        company_id=company.id,
        user_id=user.id,
        access_class=access_class,
        status=status,
        permissions_configured=permissions_configured,
    )
    db.add(membership)
    db.flush()
    sync_administrator_profile(db, membership, actor_id=None)
    return membership


def _setup_admin_matrix(db, prefix: str, **company_kwargs):
    target = _company(db, f"{prefix}-target", **company_kwargs)
    other = _company(db, f"{prefix}-other")

    demoted = _user(db, target, f"{prefix}-demoted@sysnotif.test", "admin")
    _membership(db, target, demoted, "worker", status="active")

    archived = _user(db, target, f"{prefix}-archived@sysnotif.test", "admin")
    _membership(db, target, archived, "admin", status="archived")

    suspended = _user(db, target, f"{prefix}-suspended@sysnotif.test", "admin")
    _membership(db, target, suspended, "admin", status="suspended")

    promoted = _user(db, target, f"{prefix}-promoted@sysnotif.test", "viewer")
    _membership(db, target, promoted, "admin", status="active")

    secondary = _user(db, other, f"{prefix}-secondary@sysnotif.test", "viewer")
    _membership(db, target, secondary, "admin", status="active")

    db.commit()
    return target, other, demoted, archived, suspended, promoted, secondary


def test_payment_reminders_follow_active_admin_memberships(db, monkeypatch):
    monkeypatch.setattr(payment_reminder_service.settings, "PAYMENT_REMINDERS_ENABLED", True)
    now = datetime(2026, 8, 10, 9, tzinfo=timezone.utc)
    target, _, _, _, _, promoted, secondary = _setup_admin_matrix(db, "pay")
    client = Client(
        company_id=target.id,
        name="Cliente Pago",
        address="Calle 1",
        city="Girona",
        postal_code="17001",
        country="España",
    )
    invoice = Invoice(
        company_id=target.id,
        client=client,
        invoice_number="INV-MEM-1",
        issue_date=datetime(2026, 8, 1, tzinfo=timezone.utc),
        due_date=now - timedelta(days=1),
        status="issued",
        base_amount=Decimal("100.00"),
        tax_amount=Decimal("21.00"),
        total_amount=Decimal("121.00"),
        is_active=True,
    )
    db.add(invoice)
    db.commit()

    created = payment_reminder_service.send_due_payment_notifications(db, now=now)
    assert created == 2
    rows = db.query(Notification).filter_by(event_type="invoice.payment_overdue").all()
    assert {(row.user_id, row.company_id) for row in rows} == {
        (promoted.id, target.id),
        (secondary.id, target.id),
    }


def test_fiscal_deadline_reminders_follow_active_admin_memberships(db, monkeypatch):
    monkeypatch.setattr(
        fiscal_deadline_notification_service.settings,
        "FISCAL_CALENDAR_REMINDERS_ENABLED",
        True,
    )
    target, _, _, _, _, promoted, secondary = _setup_admin_matrix(db, "fisc")
    db.add(
        CompanyFiscalSettings(
            company_id=target.id,
            quarterly_vat_enabled=True,
            quarterly_withholding_enabled=False,
            fiscal_reminder_days=7,
        )
    )
    db.commit()

    created = fiscal_deadline_notification_service.send_fiscal_deadline_notifications(
        db, today=date(2026, 10, 13)
    )
    assert created == 2
    rows = db.query(Notification).filter_by(event_type="fiscal.deadline_due_soon").all()
    assert {(row.user_id, row.company_id) for row in rows} == {
        (promoted.id, target.id),
        (secondary.id, target.id),
    }


def test_trial_expiry_reminders_follow_active_admin_emails(db, monkeypatch):
    monkeypatch.setattr(trial_expiry_notification_service.settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(
        trial_expiry_notification_service.settings,
        "TRIAL_EXPIRY_REMINDERS_ENABLED",
        True,
    )
    now = datetime(2026, 8, 10, 9, tzinfo=timezone.utc)
    target, _, _, _, _, promoted, secondary = _setup_admin_matrix(
        db,
        "trial",
        subscription_status="trialing",
        trial_ends_at=now + timedelta(days=3),
    )
    superadmin = User(
        company_id=None,
        email="trial-super@sysnotif.test",
        hashed_password="unused",
        full_name="Superadmin",
        role_id=_role_id(db, "superadmin"),
        is_active=True,
    )
    db.add(superadmin)
    db.commit()
    sent_admin_emails: list[str] = []
    monkeypatch.setattr(
        trial_expiry_notification_service.email_service,
        "send_trial_expiring_email",
        lambda **kwargs: sent_admin_emails.append(kwargs["recipient_email"]) or True,
    )
    monkeypatch.setattr(
        trial_expiry_notification_service.email_service,
        "send_trial_expiring_superadmin_email",
        lambda **kwargs: True,
    )

    assert (
        trial_expiry_notification_service.send_due_trial_expiry_notifications(db, now=now)
        == 1
    )
    assert sorted(sent_admin_emails) == sorted([promoted.email, secondary.email])


def test_operations_automation_notifies_active_multi_company_members_only(db):
    target, _, _, _, _, promoted, secondary = _setup_admin_matrix(db, "auto")
    db.add(
        StaffEmployee(
            company_id=target.id,
            name="Operaria QA",
            position="Limpieza",
            team="A",
            monthly_hours=160,
            hourly_cost=15,
            profile={
                "documents": [
                    {
                        "name": "PRL",
                        "url": "https://example.com/prl",
                        "expires_on": "2026-01-01",
                        "version": "1",
                    }
                ]
            },
        )
    )
    settings_row = OperationsAutomation(company_id=target.id, documents=True)
    db.add(settings_row)
    db.commit()

    operations_automation_service.run_company(db, settings_row)
    rows = db.query(Notification).filter_by(event_type="staff.document_due").all()
    assert {(row.user_id, row.company_id) for row in rows} == {
        (promoted.id, target.id),
        (secondary.id, target.id),
    }


def test_calendar_ownership_notifications_stay_in_target_company(db):
    target = _company(db, "cal-target")
    other = _company(db, "cal-other")
    owner = _user(db, other, "cal-owner@sysnotif.test", "viewer")
    _membership(db, target, owner, "admin", status="active")
    requester = _user(db, other, "cal-requester@sysnotif.test", "viewer")
    _membership(db, target, requester, "admin", status="active")
    db.commit()

    requester_ctx = company_recipients(db, {target.id}, {"admin"}, {requester.id})[0]
    owner_ctx = company_recipients(db, {target.id}, {"admin"}, {owner.id})[0]

    req = calendar_governance_service.request_ownership(db, requester_ctx)
    calendar_governance_service.review_ownership_request(
        db, owner_ctx, request_id=req["id"], approve=False
    )

    rows = db.query(Notification).filter_by(entity_type="calendar_ownership_request").all()
    assert len(rows) == 2
    assert {(row.user_id, row.company_id, row.event_type) for row in rows} == {
        (owner.id, target.id, "calendar.ownership_requested"),
        (requester.id, target.id, "calendar.ownership_rejected"),
    }
