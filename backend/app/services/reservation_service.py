from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.models.user import User
from app.repositories import location as location_repo
from app.repositories import reservation as reservation_repo
from app.repositories import task_item as task_item_repo
from app.schemas.reservation import ReservationCreate, ReservationResponse, ReservationUpdate
from app.schemas.work_session import WorkSessionStartLocationResponse
from app.services import location_access_service
from app.services.reservation_tasks import (
    ensure_location_access,
    get_live_external_task_snapshot,
    sync_checkout_task,
    sync_location_reservation_chain,
)
from app.services.reservation_validation import (
    get_location,
    get_owner_company_id,
    require_reservation_owner,
    validate_cleaning_schedule,
    validate_guest_capacity,
    validate_no_overlap,
    validate_service_provider,
)
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
        can_view_start_locations = (
            can_manage_company(current_user)
            and (
                current_user.company_id == reservation.owner_company_id
                or current_user.company_id == task.company_id
            )
        )
        if can_view_start_locations:
            cleaning_start_locations = [
                WorkSessionStartLocationResponse(
                    session_id=work_session.id,
                    user_id=work_session.user_id,
                    user_name=(
                        work_session.user.full_name
                        or work_session.user.email
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
    if location_access_service.can_view_sensitive(
        db, current_user, reservation.location_id
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
    if is_platform_superadmin(current_user):
        return []
    location_ids = _accessible_location_ids(db, current_user)
    if location_id is not None and location_id not in location_ids:
        raise HTTPException(status_code=404, detail="Location not found")
    company_id = scoped_company_id(current_user)
    return reservation_repo.list_reservations(
        db,
        location_ids,
        company_id,
        location_id,
        date_from,
        date_to,
    )


def list_upcoming_arrivals(
    db: Session, current_user: User, days: int = 3
) -> list[Reservation]:
    now = datetime.now(timezone.utc)
    until = now + timedelta(days=max(1, min(days, 3)))
    query = (
        db.query(Reservation)
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
                TaskItem.user_id == current_user.id,
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


def create_reservation(
    db: Session, current_user: User, data: ReservationCreate
) -> Reservation:
    location_access_service.require_location_capability(
        db, current_user, data.location_id, "can_manage_reservations"
    )
    location = get_location(db, data.location_id)
    validate_guest_capacity(location, data.guest_count)
    validate_no_overlap(db, data.location_id, data.check_in_at, data.check_out_at)
    validate_cleaning_schedule(
        db,
        data.location_id,
        data.check_out_at,
        data.cleaning_scheduled_at,
    )

    owner_company_id = get_owner_company_id(current_user, location)
    if data.assigned_company_id is not None:
        validate_service_provider(
            db,
            data.location_id,
            owner_company_id,
            data.assigned_company_id,
        )
    reservation = reservation_repo.create_reservation(
        db,
        data,
        current_user.id,
        owner_company_id,
    )

    if data.cleaning_required:
        target_company_id = data.assigned_company_id or owner_company_id
        if data.assigned_company_id is not None:
            ensure_location_access(db, data.location_id, target_company_id)
        sync_checkout_task(
            db,
            reservation,
            location,
            target_company_id,
            data.check_out_at,
            data.guest_count,
            data.cleaning_scheduled_at,
        )
    sync_location_reservation_chain(db, data.location_id)
    return reservation


def dispatch_cleaning_request(
    db: Session,
    current_user: User,
    reservation_id: int,
) -> Reservation:
    reservation = reservation_repo.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    require_reservation_owner(current_user, reservation.owner_company_id)
    location_access_service.require_location_capability(
        db, current_user, reservation.location_id, "can_manage_reservations"
    )
    if reservation.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A cancelled reservation cannot be sent as a service request.",
        )
    if not reservation.cleaning_required:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This reservation does not require a service.",
        )
    if reservation.assigned_company_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Select a collaborating company before sending the request.",
        )

    validate_service_provider(
        db,
        reservation.location_id,
        reservation.owner_company_id,
        reservation.assigned_company_id,
    )
    checkout_task = (
        db.query(TaskItem)
        .filter(TaskItem.checkout_reservation_id == reservation.id)
        .first()
    )
    if checkout_task and checkout_task.status not in {"requested", "rejected"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The receiving company has already incorporated this request.",
        )
    if checkout_task and checkout_task.status == "rejected":
        task_item_repo.delete_task_item(db, checkout_task)

    ensure_location_access(
        db, reservation.location_id, reservation.assigned_company_id
    )
    sync_checkout_task(
        db,
        reservation,
        get_location(db, reservation.location_id),
        reservation.assigned_company_id,
        reservation.check_out_at,
        reservation.guest_count,
        reservation.cleaning_scheduled_at,
    )
    reservation.service_request_sent_at = datetime.now(timezone.utc)
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    sync_location_reservation_chain(db, reservation.location_id)
    return reservation


def update_reservation(
    db: Session, current_user: User, reservation_id: int, data: ReservationUpdate
) -> Reservation:
    reservation = reservation_repo.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    require_reservation_owner(current_user, reservation.owner_company_id)
    location_access_service.require_location_capability(
        db, current_user, reservation.location_id, "can_manage_reservations"
    )

    check_in_at = data.check_in_at or reservation.check_in_at
    check_out_at = data.check_out_at or reservation.check_out_at
    if check_out_at <= check_in_at:
        raise HTTPException(
            status_code=422,
            detail="The checkout date must be after the check-in date.",
        )

    guest_count = (
        data.guest_count
        if data.guest_count is not None
        else reservation.guest_count
    )
    location = get_location(db, reservation.location_id)
    validate_guest_capacity(location, guest_count)
    validate_no_overlap(
        db,
        reservation.location_id,
        check_in_at,
        check_out_at,
        reservation.id,
    )
    proposed_cleaning_at = (
        data.cleaning_scheduled_at
        if "cleaning_scheduled_at" in data.model_fields_set
        else None
    )
    validate_cleaning_schedule(
        db,
        reservation.location_id,
        check_out_at,
        proposed_cleaning_at,
        reservation.id,
    )

    checkout_task = (
        db.query(TaskItem)
        .filter(TaskItem.checkout_reservation_id == reservation.id)
        .first()
    )
    assignment_was_submitted = "assigned_company_id" in data.model_fields_set
    previous_assigned_company_id = reservation.assigned_company_id
    assigned_company_id = (
        data.assigned_company_id
        if assignment_was_submitted
        else reservation.assigned_company_id
    )
    target_company_id = assigned_company_id or reservation.owner_company_id

    if target_company_id != reservation.owner_company_id:
        validate_service_provider(
            db,
            reservation.location_id,
            reservation.owner_company_id,
            target_company_id,
        )

    assignment_changed = (
        assignment_was_submitted
        and assigned_company_id != previous_assigned_company_id
    )
    if assignment_changed and checkout_task:
        if checkout_task.is_invoiced or checkout_task.status not in {
            "requested",
            "rejected",
            "pending",
        }:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "The service provider cannot be changed after the work "
                    "has been accepted or started."
                ),
            )
        task_item_repo.delete_task_item(db, checkout_task)
        checkout_task = None
        reservation.service_request_sent_at = None

    updated_reservation = reservation_repo.update_reservation(
        db, reservation, data, current_user.id
    )

    if updated_reservation.status == "cancelled":
        if checkout_task and not checkout_task.is_invoiced:
            task_item_repo.delete_task_item(db, checkout_task)
        sync_location_reservation_chain(db, reservation.location_id)
        return updated_reservation

    cleaning_required = (
        data.cleaning_required
        if data.cleaning_required is not None
        else updated_reservation.cleaning_required
    )
    if cleaning_required:
        cleaning_at = (
            data.cleaning_scheduled_at
            if "cleaning_scheduled_at" in data.model_fields_set
            else updated_reservation.cleaning_scheduled_at or check_out_at
        )
        if assigned_company_id is None:
            sync_checkout_task(
                db,
                updated_reservation,
                location,
                updated_reservation.owner_company_id,
                check_out_at,
                guest_count,
                cleaning_at,
            )
        elif updated_reservation.service_request_sent_at and checkout_task:
            sync_checkout_task(
                db,
                updated_reservation,
                location,
                assigned_company_id,
                check_out_at,
                guest_count,
                cleaning_at,
            )
    elif checkout_task and not checkout_task.is_invoiced:
        task_item_repo.delete_task_item(db, checkout_task)
        updated_reservation.service_request_sent_at = None
        db.add(updated_reservation)
        db.commit()
        db.refresh(updated_reservation)

    sync_location_reservation_chain(db, reservation.location_id)
    return updated_reservation


def delete_reservation(
    db: Session, current_user: User, reservation_id: int
) -> None:
    reservation = reservation_repo.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    require_reservation_owner(current_user, reservation.owner_company_id)
    location_access_service.require_location_capability(
        db, current_user, reservation.location_id, "can_manage_reservations"
    )
    location_id = reservation.location_id

    checkout_tasks = (
        db.query(TaskItem)
        .filter(TaskItem.checkout_reservation_id == reservation.id)
        .all()
    )
    for task in checkout_tasks:
        if not task.is_invoiced:
            task_item_repo.delete_task_item(db, task)
    reservation_repo.delete_reservation(db, reservation)
    sync_location_reservation_chain(db, location_id)
