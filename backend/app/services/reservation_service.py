from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.models.user import User
from app.repositories import reservation as reservation_repo
from app.repositories import task_item as task_item_repo
from app.repositories import work_session as work_session_repo
from app.schemas.reservation import ReservationCreate, ReservationUpdate
from app.services import task_lifecycle_notification_service  # noqa: F401 - compatibility re-export
from app.services.reservation_mutation_access import ReservationMutationAccess, require_reservation_mutation_access
from app.services.reservation_collaboration_service import record_external_service_request
from app.services.reservation_tasks import (
    ensure_location_access,
    get_live_external_task_snapshot,  # noqa: F401 - compatibility re-export
    sync_checkout_task,
    sync_location_reservation_chain,
)
from app.services.reservation_lifecycle_policy_service import (
    linked_work_has_started,
    require_all_linked_work_removable,
    require_linked_work_removable,
    require_provider_change_allowed,
)
from app.services.reservation_query_service import (
    build_reservation_response,  # noqa: F401 - public compatibility re-export
    get_reservation,  # noqa: F401 - public compatibility re-export
    list_reservations,  # noqa: F401 - public compatibility re-export
    list_upcoming_arrivals,  # noqa: F401 - public compatibility re-export
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


def create_reservation(db: Session, current_user: User, data: ReservationCreate, *, access: ReservationMutationAccess | None = None) -> Reservation:
    require_reservation_mutation_access(db, current_user, data.location_id, access=access)
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
    try:
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
            checkout_task = sync_checkout_task(
                db,
                reservation,
                location,
                target_company_id,
                data.check_out_at,
                data.guest_count,
                data.cleaning_scheduled_at,
            )
            if data.assigned_company_id is not None and checkout_task is not None:
                record_external_service_request(db, reservation, checkout_task)
        sync_location_reservation_chain(db, data.location_id)
        db.commit()
        db.refresh(reservation)
        return reservation
    except Exception:
        db.rollback()
        raise


def dispatch_cleaning_request(db: Session, current_user: User, reservation_id: int, *, access: ReservationMutationAccess | None = None) -> Reservation:
    reservation = reservation_repo.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    require_reservation_owner(current_user, reservation.owner_company_id)
    require_reservation_mutation_access(db, current_user, reservation.location_id, access=access)
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
    try:
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
            require_provider_change_allowed(
                checkout_task,
                has_persisted_activity=_has_linked_work_activity(db, checkout_task),
            )
            task_item_repo.delete_task_item(db, checkout_task)

        ensure_location_access(
            db, reservation.location_id, reservation.assigned_company_id
        )
        checkout_task = sync_checkout_task(
            db,
            reservation,
            get_location(db, reservation.location_id),
            reservation.assigned_company_id,
            reservation.check_out_at,
            reservation.guest_count,
            reservation.cleaning_scheduled_at,
        )
        if checkout_task is not None:
            record_external_service_request(db, reservation, checkout_task)
        sync_location_reservation_chain(db, reservation.location_id)
        db.commit()
        db.refresh(reservation)
        return reservation
    except Exception:
        db.rollback()
        raise


def _validate_reservation_update_schedule(
    db: Session,
    reservation: Reservation,
    data: ReservationUpdate,
):
    check_in_at = data.check_in_at or reservation.check_in_at
    check_out_at = data.check_out_at or reservation.check_out_at
    if check_out_at <= check_in_at:
        raise HTTPException(
            status_code=422,
            detail="The checkout date must be after the check-in date.",
        )

    guest_count = (
        data.guest_count if data.guest_count is not None else reservation.guest_count
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
    return check_in_at, check_out_at, guest_count, location


def _resolve_reservation_assignment(
    db: Session,
    reservation: Reservation,
    data: ReservationUpdate,
) -> tuple[bool, int | None]:
    assignment_was_submitted = "assigned_company_id" in data.model_fields_set
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
        and assigned_company_id != reservation.assigned_company_id
    )
    return assignment_changed, assigned_company_id


def _discard_checkout_task_for_assignment_change(
    db: Session,
    reservation: Reservation,
    checkout_task: TaskItem | None,
    assignment_changed: bool,
) -> TaskItem | None:
    if not assignment_changed or checkout_task is None:
        return checkout_task
    require_provider_change_allowed(
        checkout_task,
        has_persisted_activity=_has_linked_work_activity(db, checkout_task),
    )
    task_item_repo.delete_task_item(db, checkout_task)
    reservation.service_request_sent_at = None
    return None


def _has_linked_work_activity(db: Session, task: TaskItem) -> bool:
    return (
        linked_work_has_started(task)
        or work_session_repo.has_sessions_for_task(db, task.id)
        or task_item_repo.has_reports_for_task(db, task.id)
    )


def _cancel_updated_reservation(
    db: Session,
    reservation: Reservation,
    checkout_task: TaskItem | None,
) -> Reservation:
    if checkout_task:
        require_linked_work_removable(checkout_task, operation="cancel")
        if not _has_linked_work_activity(db, checkout_task):
            task_item_repo.delete_task_item(db, checkout_task)
    sync_location_reservation_chain(db, reservation.location_id)
    db.commit()
    db.refresh(reservation)
    return reservation


def _sync_updated_reservation_cleaning(
    db: Session,
    reservation: Reservation,
    data: ReservationUpdate,
    location,
    assigned_company_id: int | None,
    checkout_task: TaskItem | None,
    check_out_at: datetime,
    guest_count: int,
) -> None:
    cleaning_at = (
        data.cleaning_scheduled_at
        if "cleaning_scheduled_at" in data.model_fields_set
        else reservation.cleaning_scheduled_at or check_out_at
    )
    if assigned_company_id is None:
        sync_checkout_task(
            db,
            reservation,
            location,
            reservation.owner_company_id,
            check_out_at,
            guest_count,
            cleaning_at,
        )
        return
    if reservation.service_request_sent_at and checkout_task:
        sync_checkout_task(
            db,
            reservation,
            location,
            assigned_company_id,
            check_out_at,
            guest_count,
            cleaning_at,
        )
        return

    ensure_location_access(db, reservation.location_id, assigned_company_id)
    checkout_task = sync_checkout_task(
        db,
        reservation,
        location,
        assigned_company_id,
        check_out_at,
        guest_count,
        cleaning_at,
    )
    if checkout_task is not None:
        record_external_service_request(db, reservation, checkout_task)


def _remove_updated_reservation_cleaning(
    db: Session,
    reservation: Reservation,
    checkout_task: TaskItem | None,
) -> None:
    if not checkout_task:
        return
    require_linked_work_removable(
        checkout_task,
        operation="disable_cleaning",
        has_persisted_activity=_has_linked_work_activity(db, checkout_task),
    )
    task_item_repo.delete_task_item(db, checkout_task)
    reservation.service_request_sent_at = None
    db.add(reservation)


def update_reservation(db: Session, current_user: User, reservation_id: int, data: ReservationUpdate, *, access: ReservationMutationAccess | None = None) -> Reservation:
    reservation = reservation_repo.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if access and access.allow_integration_company:
        if reservation.owner_company_id != access.planning_company_id:
            raise HTTPException(status_code=404, detail="Reservation not found")
    else:
        require_reservation_owner(current_user, reservation.owner_company_id)
    require_reservation_mutation_access(db, current_user, reservation.location_id, access=access)
    _, check_out_at, guest_count, location = _validate_reservation_update_schedule(
        db,
        reservation,
        data,
    )
    assignment_changed, assigned_company_id = _resolve_reservation_assignment(
        db,
        reservation,
        data,
    )
    checkout_task = (
        db.query(TaskItem)
        .filter(TaskItem.checkout_reservation_id == reservation.id)
        .first()
    )

    try:
        checkout_task = _discard_checkout_task_for_assignment_change(
            db,
            reservation,
            checkout_task,
            assignment_changed,
        )
        updated_reservation = reservation_repo.update_reservation(
            db, reservation, data, current_user.id
        )
        if updated_reservation.status == "cancelled":
            return _cancel_updated_reservation(
                db,
                updated_reservation,
                checkout_task,
            )

        cleaning_required = (
            data.cleaning_required
            if data.cleaning_required is not None
            else updated_reservation.cleaning_required
        )
        if cleaning_required:
            _sync_updated_reservation_cleaning(
                db,
                updated_reservation,
                data,
                location,
                assigned_company_id,
                checkout_task,
                check_out_at,
                guest_count,
            )
        else:
            _remove_updated_reservation_cleaning(
                db,
                updated_reservation,
                checkout_task,
            )

        sync_location_reservation_chain(db, reservation.location_id)
        db.commit()
        db.refresh(updated_reservation)
        return updated_reservation
    except Exception:
        db.rollback()
        raise


def delete_reservation(db: Session, current_user: User, reservation_id: int, *, access: ReservationMutationAccess | None = None) -> None:
    reservation = reservation_repo.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    require_reservation_owner(current_user, reservation.owner_company_id)
    require_reservation_mutation_access(db, current_user, reservation.location_id, access=access)
    location_id = reservation.location_id

    try:
        checkout_tasks = (
            db.query(TaskItem)
            .filter(TaskItem.checkout_reservation_id == reservation.id)
            .all()
        )
        require_all_linked_work_removable(
            checkout_tasks,
            operation="delete",
            task_ids_with_activity={
                task.id
                for task in checkout_tasks
                if _has_linked_work_activity(db, task)
            },
        )
        for task in checkout_tasks:
            task_item_repo.delete_task_item(db, task)
        reservation_repo.delete_reservation(db, reservation)
        sync_location_reservation_chain(db, location_id)
        db.commit()
    except Exception:
        db.rollback()
        raise
