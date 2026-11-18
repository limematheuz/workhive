"""Canonical company visibility for internal and externally requested work."""

from sqlalchemy import and_, or_

from app.models.reservation import Reservation
from app.models.task_item import TaskItem


def company_task_condition(company_id: int):
    return or_(
        and_(TaskItem.status != "rejected", TaskItem.company_id == company_id),
        and_(TaskItem.status == "rejected", TaskItem.checkout_reservation_id.is_(None),
             TaskItem.company_id == company_id),
        TaskItem.checkout_reservation.has(Reservation.owner_company_id == company_id),
    )
