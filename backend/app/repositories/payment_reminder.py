from sqlalchemy.orm import Session, selectinload

from app.models.company import Company
from app.models.invoice import Invoice
from app.models.user import User


PAYMENT_REMINDER_STATUSES = ("issued", "overdue")


def list_unpaid_invoices_with_due_date(db: Session) -> list[Invoice]:
    """Return active, billable invoices with the data needed for reminders."""
    return (
        db.query(Invoice)
        .options(
            selectinload(Invoice.company)
            .selectinload(Company.users)
            .selectinload(User.role)
        )
        .filter(
            Invoice.is_active.is_(True),
            Invoice.status.in_(PAYMENT_REMINDER_STATUSES),
            Invoice.due_date.isnot(None),
        )
        .order_by(Invoice.due_date.asc(), Invoice.id.asc())
        .all()
    )
