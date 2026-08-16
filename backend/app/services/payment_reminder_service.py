import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.invoice import Invoice
from app.models.user import User
from app.repositories import payment_reminder as payment_reminder_repo
from app.services import notification_service


logger = logging.getLogger("workhive.payment_reminders")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    return (
        value.replace(tzinfo=timezone.utc)
        if value.tzinfo is None
        else value.astimezone(timezone.utc)
    )


def _company_admins(invoice: Invoice) -> list[User]:
    if not invoice.company or not invoice.company.users:
        return []
    return [
        user
        for user in invoice.company.users
        if user.is_active and user.role and user.role.name == "admin"
    ]


def _notification_payload(
    invoice: Invoice, *, now: datetime
) -> tuple[str, str, str, str] | None:
    if invoice.due_date is None:
        return None

    days_until_due = (_as_utc(invoice.due_date).date() - now.date()).days
    if days_until_due < 0:
        return (
            "invoice.payment_overdue",
            f"Cobro vencido: {invoice.invoice_number}",
            f"La factura {invoice.invoice_number} sigue pendiente desde el {invoice.due_date.date().isoformat()}.",
            "payment-overdue",
        )
    if days_until_due <= settings.PAYMENT_REMINDER_DAYS_BEFORE_DUE:
        day_label = "hoy" if days_until_due == 0 else f"en {days_until_due} días"
        return (
            "invoice.payment_due_soon",
            f"Cobro pendiente: {invoice.invoice_number}",
            f"La factura {invoice.invoice_number} vence {day_label} ({invoice.due_date.date().isoformat()}).",
            "payment-due-soon",
        )
    return None


def send_due_payment_notifications(
    db: Session,
    *,
    now: datetime | None = None,
) -> int:
    """Create one in-app alert per unpaid invoice and reminder stage.

    Invoice status is deliberately not changed here: whether a collection is
    legally overdue is a financial decision, while this job only reminds the
    company to review it.
    """
    if not settings.PAYMENT_REMINDERS_ENABLED:
        return 0

    current_time = _as_utc(now or _utcnow())
    notification_count = 0
    for invoice in payment_reminder_repo.list_unpaid_invoices_with_due_date(db):
        if not invoice.company or not invoice.company.is_active:
            continue
        payload = _notification_payload(invoice, now=current_time)
        recipients = _company_admins(invoice)
        if payload is None or not recipients:
            continue

        event_type, title, message, stage = payload
        notification_count += notification_service.notify_users_once(
            db,
            users=recipients,
            event_type=event_type,
            title=title,
            message=message,
            entity_type="invoice",
            entity_id=invoice.id,
            href=f"/dashboard/invoices/{invoice.id}",
            dedupe_key=f"invoice:{invoice.id}:{stage}",
            metadata={"invoice_number": invoice.invoice_number, "stage": stage},
            commit=False,
        )
    db.commit()
    return notification_count


def run_payment_reminder_check() -> None:
    db = SessionLocal()
    try:
        send_due_payment_notifications(db)
    except Exception:
        db.rollback()
        logger.exception("Payment reminder check failed")
    finally:
        db.close()


async def periodic_payment_reminder_check() -> None:
    if not settings.PAYMENT_REMINDERS_ENABLED:
        return
    interval = max(60, settings.PAYMENT_REMINDER_INTERVAL_SECONDS)
    while True:
        try:
            await asyncio.to_thread(run_payment_reminder_check)
            await asyncio.sleep(interval)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Unexpected payment reminder loop failure")
