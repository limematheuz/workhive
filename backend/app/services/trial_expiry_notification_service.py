import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.company import Company
from app.models.user import User
from app.services import email_service
from app.services.company_notification_recipients import recipients as company_recipients


logger = logging.getLogger("workhive.trial_expiry")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _is_due(company: Company, now: datetime) -> bool:
    return (
        company.subscription_status == "trialing"
        and company.trial_ends_at is not None
        and company.trial_expiry_notice_sent_at is None
        and (_as_utc(company.trial_ends_at).date() - now.date()).days == 3
    )


def _company_admins(db: Session, company: Company) -> list[User]:
    by_email: dict[str, User] = {}
    for user in company_recipients(db, {company.id}, {"admin"}):
        if user.email:
            by_email.setdefault(user.email.strip().lower(), user)
    return [by_email[email] for email in sorted(by_email)]


def _superadmin_emails(db: Session, exclude: set[str]) -> list[str]:
    return sorted(
        {
            user.email.strip().lower()
            for user in db.query(User).all()
            if user.is_active
            and user.email
            and user.role
            and user.role.name == "superadmin"
            and user.email.strip().lower() not in exclude
        }
    )


def _deliver(send, **payload) -> bool:
    try:
        return bool(send(**payload))
    except Exception:
        logger.exception("Trial warning email delivery crashed")
        return False


def send_due_trial_expiry_notifications(
    db: Session,
    *,
    now: datetime | None = None,
) -> int:
    """Send one three-day warning per trial company, safely across workers."""
    if not settings.EMAIL_ENABLED or not settings.TRIAL_EXPIRY_REMINDERS_ENABLED:
        return 0

    current_time = _as_utc(now or _utcnow())
    companies = (
        db.query(Company)
        .filter(
            Company.subscription_status == "trialing",
            Company.trial_ends_at.isnot(None),
            Company.trial_expiry_notice_sent_at.is_(None),
        )
        .with_for_update(skip_locked=True)
        .all()
    )
    sent_count = 0
    for company in companies:
        if not _is_due(company, current_time):
            continue

        company_admins = _company_admins(db, company)
        company_admin_emails = [user.email.strip().lower() for user in company_admins]
        superadmin_emails = _superadmin_emails(db, set(company_admin_emails))
        if not company_admins or not superadmin_emails:
            logger.warning(
                "Trial warning recipients are incomplete",
                extra={"company_id": company.id},
            )
            continue

        delivered = True
        for user in company_admins:
            delivered = _deliver(
                email_service.send_trial_expiring_email,
                recipient_email=user.email,
                recipient_name=user.full_name or user.email,
                company_name=company.name,
                trial_ends_at=_as_utc(company.trial_ends_at),
            ) and delivered
        for recipient_email in superadmin_emails:
            delivered = _deliver(
                email_service.send_trial_expiring_superadmin_email,
                recipient_email=recipient_email,
                company_name=company.name,
                trial_ends_at=_as_utc(company.trial_ends_at),
            ) and delivered

        if not delivered:
            logger.warning("Trial warning delivery failed", extra={"company_id": company.id})
            continue
        company.trial_expiry_notice_sent_at = current_time
        sent_count += 1

    db.commit()
    return sent_count


def run_trial_expiry_notification_check() -> None:
    db = SessionLocal()
    try:
        send_due_trial_expiry_notifications(db)
    except Exception:
        db.rollback()
        logger.exception("Trial expiry notification check failed")
    finally:
        db.close()


async def periodic_trial_expiry_notification_check() -> None:
    if not settings.TRIAL_EXPIRY_REMINDERS_ENABLED:
        return
    interval = max(60, settings.TRIAL_EXPIRY_REMINDER_INTERVAL_SECONDS)
    while True:
        try:
            await asyncio.to_thread(run_trial_expiry_notification_check)
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Unexpected trial expiry notification loop failure")
