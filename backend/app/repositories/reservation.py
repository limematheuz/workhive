from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.models.location import Location
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.models.work_session import WorkSession
from app.schemas.reservation import ReservationCreate, ReservationUpdate


def _load_options():
    return (
        selectinload(Reservation.location).selectinload(Location.client),
        selectinload(Reservation.location).selectinload(Location.company_access),
        selectinload(Reservation.owner_company),
        selectinload(Reservation.assigned_company),
        selectinload(Reservation.created_by),
        selectinload(Reservation.checkout_tasks).selectinload(TaskItem.company),
        selectinload(Reservation.checkout_tasks)
        .selectinload(TaskItem.work_sessions)
        .selectinload(WorkSession.user),
    )


def list_reservations(
    db: Session,
    location_ids: list[int],
    company_id: int | None = None,
    location_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[Reservation]:
    if not location_ids:
        return []
    query = (
        db.query(Reservation)
        .options(*_load_options())
        .filter(Reservation.location_id.in_(location_ids))
    )
    if company_id is not None:
        query = query.filter(
            or_(
                Reservation.owner_company_id == company_id,
                Reservation.assigned_company_id == company_id,
            )
        )
    if location_id is not None:
        query = query.filter(Reservation.location_id == location_id)
    if date_from is not None:
        query = query.filter(Reservation.check_out_at >= date_from)
    if date_to is not None:
        query = query.filter(Reservation.check_in_at <= date_to)
    return query.order_by(Reservation.check_in_at.asc()).all()


def get_reservation(db: Session, reservation_id: int) -> Reservation | None:
    return (
        db.query(Reservation)
        .options(*_load_options())
        .filter(Reservation.id == reservation_id)
        .first()
    )


def find_overlaps(
    db: Session,
    location_id: int,
    check_in_at: datetime,
    check_out_at: datetime,
    exclude_reservation_id: int | None = None,
) -> list[Reservation]:
    query = db.query(Reservation).filter(
        Reservation.location_id == location_id,
        Reservation.status != "cancelled",
        Reservation.check_in_at < check_out_at,
        Reservation.check_out_at > check_in_at,
    )
    if exclude_reservation_id is not None:
        query = query.filter(Reservation.id != exclude_reservation_id)
    return query.all()


def create_reservation(
    db: Session, data: ReservationCreate, user_id: int, owner_company_id: int
) -> Reservation:
    db_data = data.model_dump()
    reservation = Reservation(
        **db_data,
        owner_company_id=owner_company_id,
        created_by_user_id=user_id,
        updated_by_user_id=user_id,
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    return reservation


def update_reservation(
    db: Session, reservation: Reservation, data: ReservationUpdate, user_id: int
) -> Reservation:
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(reservation, key, value)
    reservation.updated_by_user_id = user_id
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    return reservation


def delete_reservation(db: Session, reservation: Reservation) -> None:
    db.delete(reservation)
    db.commit()
