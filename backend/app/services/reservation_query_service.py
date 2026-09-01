"""Read models and visibility rules for reservations.

Reservation commands live in ``reservation_service``.  Keeping the read side
here makes the API's polling endpoints independent from mutation workflows.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.models.task_structure import TaskAssignment
from app.models.user import User
from app.models.work_session import WorkSession
from app.repositories import location as location_repo
from app.repositories import reservation as reservation_repo
from app.schemas.reservation import ReservationResponse
from app.schemas.work_session import WorkSessionStartLocationResponse
from app.services import location_access_service
from app.services.planning_access_service import require_user_planning
from app.services.user_scope import (
    can_manage_company,
    is_platform_superadmin,
    scoped_company_id,
)


def build_reservation_response(
    db: Session,
    reservation: Reservation,
    current_user: User,
) -> ReservationResponse:
    """Build the reservation projection allowed for the requesting user."""
    response = ReservationResponse.model_validate(reservation)
    assigned_company_id = reservation.assigned_company_id
    assigned_company_name = reservation.assigned_company_name
    cleaning_status = (
        "not_sent"
        if reservation.cleaning_required and reservation.assigned_company_id
        else None
    )
    cleaning_scheduled_at = reservation.cleaning_scheduled_at
    cleaning_start_locations: list[WorkSessionStartLocationResponse] = []
    if reservation.checkout_tasks:
        task = reservation.checkout_tasks[0]
        if task.company_id != reservation.owner_company_id:
            assigned_company_id = task.company_id
            assigned_company_name = task.company.name if task.company else None
        cleaning_status = task.status
        cleaning_scheduled_at = task.scheduled_start_at
        can_view_start_locations = can_manage_company(current_user) and (
            current_user.company_id == reservation.owner_company_id
            or current_user.company_id == task.company_id
        )
        if can_view_start_locations:
            cleaning_start_locations = [
                WorkSessionStartLocationResponse(
                    session_id=work_session.id,
                    user_id=work_session.user_id,
                    user_name=(
                        work_session.user.full_name or work_session.user.email
                        if work_session.user
                        else f"User {work_session.user_id}"
                    ),
                    started_at=work_session.start_time,
                    latitude=work_session.start_latitude,
                    longitude=work_session.start_longitude,
                    accuracy_meters=work_session.start_accuracy_meters,
                )
                for work_session in task.work_sessions
                if work_session.start_latitude is not None
                and work_session.start_longitude is not None
            ]
    response = response.model_copy(
        update={
            "assigned_company_id": assigned_company_id,
            "assigned_company_name": assigned_company_name,
            "cleaning_status": cleaning_status,
            "cleaning_scheduled_at": cleaning_scheduled_at,
            "cleaning_start_locations": cleaning_start_locations,
        }
    )
    if location_access_service.can_view_sensitive_loaded(
        current_user,
        reservation.location,
    ):
        return response
    return response.model_copy(update={"notes": None, "external_reference": None})


def _accessible_location_ids(db: Session, current_user: User) -> list[int]:
    company_id = scoped_company_id(current_user)
    return [
        location.id
        for location in location_repo.get_locations_by_client(
            db, company_id, client_id=None, skip=0, limit=10000
        )
    ]


def list_reservations(
    db: Session,
    current_user: User,
    location_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[Reservation]:
    require_user_planning(db, current_user)
    if is_platform_superadmin(current_user):
        return []
    location_ids = _accessible_location_ids(db, current_user)
    if location_id is not None and location_id not in location_ids:
        raise HTTPException(status_code=404, detail="Location not found")
    return reservation_repo.list_reservations(
        db,
        location_ids,
        scoped_company_id(current_user),
        location_id,
        date_from,
        date_to,
    )


def list_upcoming_arrivals(
    db: Session, current_user: User, days: int = 3
) -> list[Reservation]:
    require_user_planning(db, current_user)
    now = datetime.now(timezone.utc)
    until = now + timedelta(days=max(1, min(days, 3)))
    query = (
        db.query(Reservation)
        .options(
            selectinload(Reservation.owner_company),
            selectinload(Reservation.created_by),
            selectinload(Reservation.checkout_tasks).selectinload(TaskItem.company),
            selectinload(Reservation.checkout_tasks)
            .selectinload(TaskItem.work_sessions)
            .selectinload(WorkSession.user),
        )
        .filter(
            Reservation.status != "cancelled",
            Reservation.check_in_at >= now,
            Reservation.check_in_at <= until,
        )
    )
    if not is_platform_superadmin(current_user):
        company_id = current_user.company_id
        if company_id is None:
            return []
        linked_reservation_ids = (
            db.query(Reservation.id)
            .join(
                TaskItem,
                or_(
                    TaskItem.checkout_reservation_id == Reservation.id,
                    TaskItem.next_reservation_id == Reservation.id,
                ),
            )
            .filter(
                TaskItem.company_id == company_id,
                TaskItem.status != "rejected",
            )
        )
        query = query.filter(
            or_(
                Reservation.owner_company_id == company_id,
                Reservation.id.in_(linked_reservation_ids),
            )
        )
    return query.order_by(Reservation.check_in_at.asc()).distinct().all()


def get_reservation(
    db: Session, current_user: User, reservation_id: int
) -> Reservation:
    require_user_planning(db, current_user)
    reservation = reservation_repo.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    location_access_service.require_accessible_location(
        db, current_user, reservation.location_id
    )
    if current_user.role.name == "viewer":
        assigned_link = (
            db.query(TaskItem.id)
            .filter(
                or_(
                    TaskItem.user_id == current_user.id,
                    TaskItem.assignments.any(TaskAssignment.user_id == current_user.id),
                ),
                (
                    (TaskItem.checkout_reservation_id == reservation.id)
                    | (TaskItem.next_reservation_id == reservation.id)
                ),
            )
            .first()
        )
        if not assigned_link:
            raise HTTPException(status_code=404, detail="Reservation not found")
    return reservation
