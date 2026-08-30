from datetime import datetime, timedelta, timezone

from app.models.company import Company
from app.models.user import User
from app.services import trial_expiry_notification_service


def _trial_company(db, *, ends_at: datetime) -> tuple[Company, User, User]:
    company = Company(
        name="Trial Clean",
        tax_id="TRIAL-EXPIRY-1",
        address="Calle Trial 1",
        phone="600000000",
        email="company@example.com",
        subscription_plan="top",
        subscription_status="trialing",
        trial_started_at=ends_at - timedelta(days=14),
        trial_ends_at=ends_at,
    )
    owner = User(
        email="owner@example.com",
        hashed_password="unused",
        full_name="Trial Owner",
        role_id=1,
        company=company,
        is_active=True,
    )
    superadmin = User(
        email="platform@example.com",
        hashed_password="unused",
        full_name="Platform Admin",
        role_id=4,
        is_active=True,
    )
    db.add_all([company, owner, superadmin])
    db.commit()
    db.refresh(company)
    return company, owner, superadmin


def test_due_trial_notifies_company_admin_and_superadmin_once(db, monkeypatch):
    now = datetime(2026, 8, 1, 9, tzinfo=timezone.utc)
    company, owner, superadmin = _trial_company(db, ends_at=now + timedelta(days=3))
    delivered: list[tuple[str, str]] = []

    monkeypatch.setattr(
        trial_expiry_notification_service.email_service,
        "send_trial_expiring_email",
        lambda **data: delivered.append(("company", data["recipient_email"])) or True,
    )
    monkeypatch.setattr(
        trial_expiry_notification_service.email_service,
        "send_trial_expiring_superadmin_email",
        lambda **data: delivered.append(("platform", data["recipient_email"])) or True,
    )

    assert trial_expiry_notification_service.send_due_trial_expiry_notifications(db, now=now) == 1
    db.refresh(company)
    assert trial_expiry_notification_service._as_utc(company.trial_expiry_notice_sent_at) == now
    assert delivered == [("company", owner.email), ("platform", superadmin.email)]

    assert trial_expiry_notification_service.send_due_trial_expiry_notifications(db, now=now) == 0
    assert delivered == [("company", owner.email), ("platform", superadmin.email)]


def test_trial_expiry_warning_skips_other_dates_and_does_not_mark_on_delivery_failure(db, monkeypatch):
    now = datetime(2026, 8, 1, 9, tzinfo=timezone.utc)
    company, _, _ = _trial_company(db, ends_at=now + timedelta(days=2))

    assert trial_expiry_notification_service.send_due_trial_expiry_notifications(db, now=now) == 0
    assert company.trial_expiry_notice_sent_at is None

    company.trial_ends_at = now + timedelta(days=3)
    db.commit()
    monkeypatch.setattr(
        trial_expiry_notification_service.email_service,
        "send_trial_expiring_email",
        lambda **_data: False,
    )
    monkeypatch.setattr(
        trial_expiry_notification_service.email_service,
        "send_trial_expiring_superadmin_email",
        lambda **_data: True,
    )

    assert trial_expiry_notification_service.send_due_trial_expiry_notifications(db, now=now) == 0
    db.refresh(company)
    assert company.trial_expiry_notice_sent_at is None
