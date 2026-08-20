"""Internal reminders for configured quarterly Spanish fiscal obligations."""

import asyncio
import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.company_fiscal_settings import CompanyFiscalSettings
from app.models.user import User
from app.repositories import fiscal_deadline_notification as fiscal_deadline_notification_repo
from app.services import notification_service


logger = logging.getLogger("workhive.fiscal_deadlines")


@dataclass(frozen=True)
class FiscalDeadline:
    model: str
    tax_period: str
    due_date: date
    reminder_date: date


_QUARTERLY_DUE_DATES = (
    (4, 20, 0, "T1"),
    (7, 20, 0, "T2"),
    (10, 20, 0, "T3"),
    (1, 30, 1, "T4"),
)


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _company_admins(fiscal_settings: CompanyFiscalSettings) -> list[User]:
    company = fiscal_settings.company
    if not company or not company.users:
        return []
    return [
        user
        for user in company.users
        if user.is_active and user.role and user.role.name == "admin"
    ]


def _enabled_models(fiscal_settings: CompanyFiscalSettings) -> tuple[str, ...]:
    models: list[str] = []
    if fiscal_settings.quarterly_vat_enabled:
        models.append("303")
    if fiscal_settings.quarterly_withholding_enabled:
        models.append("111")
    return tuple(models)


def _deadlines_for_tax_year(
    tax_year: int,
    fiscal_settings: CompanyFiscalSettings,
) -> list[FiscalDeadline]:
    reminder_days = max(1, min(30, fiscal_settings.fiscal_reminder_days))
    return [
        FiscalDeadline(
            model=model,
            tax_period=f"{quarter} {tax_year}",
            due_date=date(tax_year + due_year_offset, month, day),
            reminder_date=date(tax_year + due_year_offset, month, day)
            - timedelta(days=reminder_days),
        )
        for model in _enabled_models(fiscal_settings)
        for month, day, due_year_offset, quarter in _QUARTERLY_DUE_DATES
    ]


def fiscal_deadlines_due_this_calendar_year(
    fiscal_settings: CompanyFiscalSettings,
    *,
    today: date,
) -> list[FiscalDeadline]:
    """Return deadlines payable in today's calendar year.

    The fourth quarter is due in January of the following year, so January
    must include the prior tax year's T4 instead of silently skipping it.
    """
    return sorted(
        (
            deadline
            for tax_year in (today.year - 1, today.year)
            for deadline in _deadlines_for_tax_year(tax_year, fiscal_settings)
            if deadline.due_date.year == today.year
        ),
        key=lambda deadline: (deadline.due_date, deadline.model),
    )


def _notification_payload(deadline: FiscalDeadline, *, today: date) -> tuple[str, str, str, str]:
    days_until_due = (deadline.due_date - today).days
    day_label = "hoy" if days_until_due == 0 else f"en {days_until_due} días"
    return (
        "fiscal.deadline_due_soon",
        f"Recordatorio fiscal: modelo {deadline.model}",
        (
            f"El modelo {deadline.model} del {deadline.tax_period} vence {day_label} "
            f"({deadline.due_date.isoformat()}). Revise el calendario oficial antes de presentarlo."
        ),
        f"fiscal:{deadline.model}:{deadline.due_date.isoformat()}",
    )


def send_fiscal_deadline_notifications(
    db: Session,
    *,
    today: date | None = None,
) -> int:
    """Notify active company admins once during each configured reminder window."""
    if not settings.FISCAL_CALENDAR_REMINDERS_ENABLED:
        return 0

    current_day = today or _today()
    notification_count = 0
    for fiscal_settings in (
        fiscal_deadline_notification_repo.list_companies_with_fiscal_reminders(db)
    ):
        recipients = _company_admins(fiscal_settings)
        if not recipients:
            continue
        for deadline in fiscal_deadlines_due_this_calendar_year(
            fiscal_settings, today=current_day
        ):
            if not (deadline.reminder_date <= current_day <= deadline.due_date):
                continue
            event_type, title, message, dedupe_key = _notification_payload(
                deadline, today=current_day
            )
            notification_count += notification_service.notify_users_once(
                db,
                users=recipients,
                event_type=event_type,
                title=title,
                message=message,
                entity_type="company_fiscal_settings",
                entity_id=fiscal_settings.id,
                href="/dashboard/fiscal-calendar",
                dedupe_key=dedupe_key,
                metadata={
                    "model": deadline.model,
                    "tax_period": deadline.tax_period,
                    "due_date": deadline.due_date.isoformat(),
                },
                commit=False,
            )
    db.commit()
    return notification_count


def run_fiscal_deadline_notification_check() -> None:
    db = SessionLocal()
    try:
        send_fiscal_deadline_notifications(db)
    except Exception:
        db.rollback()
        logger.exception("Fiscal deadline reminder check failed")
    finally:
        db.close()


async def periodic_fiscal_deadline_notification_check() -> None:
    if not settings.FISCAL_CALENDAR_REMINDERS_ENABLED:
        return
    interval = max(60, settings.FISCAL_CALENDAR_REMINDER_INTERVAL_SECONDS)
    while True:
        try:
            await asyncio.to_thread(run_fiscal_deadline_notification_check)
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Unexpected fiscal deadline reminder loop failure")
