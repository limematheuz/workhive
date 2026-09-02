from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.services import task_lifecycle_notification_service
from app.services.company_client_service import ensure_company_as_client


def record_external_service_request(
    db: Session,
    reservation: Reservation,
    task: TaskItem,
) -> None:
    if task.company_id == reservation.owner_company_id:
        return
    reservation.service_request_sent_at = datetime.now(timezone.utc)
    ensure_company_as_client(
        db,
        owner_company_id=task.company_id,
        partner_company=reservation.owner_company,
    )
    db.add(reservation)
    task_lifecycle_notification_service.notify_request_sent(
        db,
        reservation,
        task,
        commit=False,
    )
