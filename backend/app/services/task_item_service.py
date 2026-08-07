from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import status, HTTPException
from app.models.task_item import TaskItem
from app.schemas.task_item import (
    TaskAcceptRequest,
    TaskItemCreate,
    TaskItemResponse,
    TaskItemUpdate,
    TaskChecklistItemUpdate,
)
from app.repositories import task_item as task_item_repo
from app.repositories import async_task_item as async_task_item_repo
from app.repositories import user as user_repo
from app.repositories import reservation as reservation_repo
from app.services import location_access_service
from app.models.user import User
from app.models.work_session import WorkSession
from app.repositories import work_session as work_session_repo
from app.services import (
    calendar_sync_service,
    notification_service,
    task_assignment_service,
    task_lifecycle_notification_service,
    task_structure_service,
)
from app.services.company_client_service import ensure_company_as_client
from app.models.task_structure import TaskChecklistItem
from app.services.calendar_task_owner_service import resolve_calendar_owner_user_id


def _close_active_task_sessions(
    db: Session,
    task_id: int,
    end_time: datetime,
) -> None:
    sessions = [
        session
        for session in work_session_repo.get_sessions_by_task(db, task_id)
        if session.end_time is None
    ]
    newest_by_user: dict[int, WorkSession] = {}
    for session in sorted(sessions, key=lambda item: item.id, reverse=True):
        if session.user_id not in newest_by_user:
            newest_by_user[session.user_id] = session
            session.end_time = end_time
        else:
            session.end_time = session.start_time
        db.add(session)


def _complete_task_when_checklist_is_done(
    db: Session,
    task: TaskItem,
) -> bool:
    if task.status in {"requested", "rejected", "completed"}:
        return False
    if not task_assignment_service.all_task_checklist_items_are_complete(task):
        return False

    completed_at = datetime.now(timezone.utc)
    task.status = "completed"
    task.date_done = completed_at
    _close_active_task_sessions(db, task.id, completed_at)
    return True


def get_task_items(
    db: Session,
    company_id: int,
    user_id: int | None = None,
    location_id: int | None = None,
    task_status: str | None = None,
    skip: int = 0,
    limit: int = 100,
    include_requested: bool = False,
) -> list[TaskItem]:
    return task_item_repo.get_task_items(
        db,
        company_id,
        user_id,
        location_id,
        task_status,
        skip,
        limit,
        include_requested,
    )


async def get_task_items_async(
    db: AsyncSession,
    company_id: int,
    user_id: int | None = None,
    location_id: int | None = None,
    task_status: str | None = None,
    skip: int = 0,
    limit: int = 100,
    include_requested: bool = False,
) -> list[TaskItem]:
    return await async_task_item_repo.get_task_items(
        db,
        company_id,
        user_id,
        location_id,
        task_status,
        skip,
        limit,
        include_requested,
    )


async def get_task_item_async(
    db: AsyncSession,
    current_user: User,
    task_item_id: int,
) -> TaskItem:
    existing = await async_task_item_repo.get_task_item(
        db,
        current_user.company_id,
        task_item_id,
    )
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task Item not found",
        )
    return existing


def get_task_item(db: Session, current_user: User, task_item_id: int) -> TaskItem:
    existing = task_item_repo.get_task_item(db, current_user.company_id, task_item_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task Item not found"
        )
    return existing


def build_task_response(
    db: Session,
    task: TaskItem,
    current_user: User,
) -> TaskItemResponse:
    from app.services import reservation_service

    response = TaskItemResponse.model_validate(task)
    live_snapshot = reservation_service.get_live_external_task_snapshot(db, task)
    if live_snapshot:
        response = response.model_copy(update=live_snapshot)
    if not location_access_service.can_view_sensitive(
        db,
        current_user,
        task.location_id,
    ):
        return response.model_copy(update={"price": None})
    return response


def build_loaded_task_response(
    task: TaskItem,
    current_user: User,
) -> TaskItemResponse:
    from app.services.reservation_tasks import get_live_external_task_snapshot_loaded

    response = TaskItemResponse.model_validate(task)
    live_snapshot = get_live_external_task_snapshot_loaded(task)
    if live_snapshot:
        response = response.model_copy(update=live_snapshot)
    if not location_access_service.can_view_sensitive_loaded(
        current_user,
        task.location,
    ):
        return response.model_copy(update={"price": None})
    return response


def _validate_reservation_links(
    db: Session,
    location_id: int,
    checkout_reservation_id: int | None,
    next_reservation_id: int | None,
) -> None:
    if (
        checkout_reservation_id is not None
        and checkout_reservation_id == next_reservation_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Checkout and next arrival must be different reservations",
        )
    for reservation_id in [checkout_reservation_id, next_reservation_id]:
        if reservation_id is None:
            continue
        reservation = reservation_repo.get_reservation(db, reservation_id)
        if not reservation or reservation.location_id != location_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Linked reservations must belong to the task location",
            )


def _freeze_live_external_snapshot(db: Session, task: TaskItem) -> None:
    from app.services import reservation_service

    live_snapshot = reservation_service.get_live_external_task_snapshot(db, task)
    if "description" in live_snapshot:
        live_snapshot["description"] = (
            task_assignment_service.merge_checklist_assignments(
                task.description,
                live_snapshot["description"],
            )
        )
    for field, value in live_snapshot.items():
        setattr(task, field, value)


def _notify_new_task_assignees(
    db: Session,
    task: TaskItem,
    user_ids: set[int],
) -> None:
    if not user_ids or task.status in {"requested", "rejected", "completed"}:
        return
    recipients = (
        db.query(User)
        .filter(
            User.id.in_(user_ids),
            User.company_id == task.company_id,
            User.is_active.is_(True),
        )
        .all()
    )
    if not recipients:
        return
    notification_service.notify_users(
        db,
        users=recipients,
        event_type="task.assigned",
        title="Nueva tarea asignada",
        message=task.title,
        entity_type="task_item",
        entity_id=task.id,
        href=f"/dashboard?taskId={task.id}",
    )


def create_task_item(
    db: Session, current_user: User, task_item_data: TaskItemCreate
) -> TaskItem:
    location_access_service.require_location_capability(
        db, current_user, task_item_data.location_id, "can_manage_tasks"
    )
    if task_item_data.user_id is not None:
        assigned_user = user_repo.get_user_by_id(db, task_item_data.user_id)
        if not assigned_user or assigned_user.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned user not found or does not belong to your company",
            )
    if (
        task_item_data.checkout_reservation_id is not None
        or task_item_data.next_reservation_id is not None
    ):
        location_access_service.require_location_capability(
            db,
            current_user,
            task_item_data.location_id,
            "can_manage_reservations",
        )
    _validate_reservation_links(
        db,
        task_item_data.location_id,
        task_item_data.checkout_reservation_id,
        task_item_data.next_reservation_id,
    )
    task_structure_service.validate_description_assignees(
        db,
        current_user.company_id,
        task_item_data.description,
    )
    # Manual work starts in the pending column. External company requests are
    # created by the reservation flow and remain requested.
    task_item_data = task_item_data.model_copy(
        update={
            "status": "pending",
            "operational_notes": [],
            "attachments": [],
            "reported_issues": [],
        }
    )
    task = task_item_repo.create_task_item(
        db,
        current_user.company_id,
        task_item_data,
    )
    task_structure_service.sync_from_description(db, task)
    _complete_task_when_checklist_is_done(db, task)
    db.commit()
    db.refresh(task)
    _notify_new_task_assignees(
        db,
        task,
        task_assignment_service.assigned_user_ids(task),
    )
    calendar_sync_service.enqueue_task_sync(db, task)
    return task


def _require_mutable_task_for_update(
    db: Session,
    current_user: User,
    task_item_id: int,
) -> TaskItem:
    task = task_item_repo.get_task_item(
        db,
        current_user.company_id,
        task_item_id,
    )
    if not task or task.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task Item not found",
        )
    if task.is_invoiced:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invoiced tasks cannot be modified",
        )
    return task


def _is_external_reservation_task(task: TaskItem, current_user: User) -> bool:
    return bool(
        task.checkout_reservation
        and task.checkout_reservation.owner_company_id != current_user.company_id
        and task.company_id == current_user.company_id
    )


def _validate_task_report_fields(task_data: TaskItemUpdate) -> None:
    immutable_report_fields = {
        "operational_notes",
        "attachments",
        "reported_issues",
    }
    if task_data.model_fields_set & immutable_report_fields:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Task report history can only be appended through task reports",
        )


def _validate_external_task_update(
    current_user: User,
    task_data: TaskItemUpdate,
    is_external: bool,
) -> None:
    if is_external and current_user.role.name != "viewer":
        allowed_external_fields = {
            "description",
            "checklist_evidence",
            "price",
            "quantity",
            "unit",
            "user_id",
            "scheduled_start_at",
            "status",
            "date_done",
        }
        if not task_data.model_fields_set.issubset(allowed_external_fields):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The receiving company can only update operational planning fields",
            )


def _validate_worker_task_update(
    task: TaskItem,
    current_user: User,
    task_data: TaskItemUpdate,
) -> None:
    allowed_fields = {"description", "checklist_evidence"}
    if not task_data.model_fields_set.issubset(allowed_fields):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Field workers can only update task progress and operational notes",
        )
    if not task_assignment_service.is_user_assigned(task, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Field workers can only update their assigned tasks",
        )
    description_changed = "description" in task_data.model_fields_set
    can_update_description = (
        not description_changed
        or task_assignment_service.validate_worker_description_update(
            task.description,
            task_data.description,
            current_user.id,
            task.user_id == current_user.id,
        )
    )
    if not can_update_description:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Field workers can only update their assigned checklist items",
        )


def _validate_task_update_scope(
    db: Session,
    task: TaskItem,
    current_user: User,
    task_data: TaskItemUpdate,
) -> bool:
    _validate_task_report_fields(task_data)
    is_external = _is_external_reservation_task(task, current_user)
    _validate_external_task_update(current_user, task_data, is_external)
    if current_user.role.name == "viewer":
        _validate_worker_task_update(task, current_user, task_data)
    else:
        location_access_service.require_location_capability(
            db,
            current_user,
            task.location_id,
            "can_manage_tasks",
        )
    return is_external


def _validate_task_update_relations(
    db: Session,
    task: TaskItem,
    current_user: User,
    task_data: TaskItemUpdate,
) -> None:
    target_location_id = task_data.location_id or task.location_id
    if task_data.location_id is not None:
        location_access_service.require_location_capability(
            db, current_user, task_data.location_id, "can_manage_tasks"
        )
    if {
        "checkout_reservation_id",
        "next_reservation_id",
    } & task_data.model_fields_set:
        location_access_service.require_location_capability(
            db,
            current_user,
            target_location_id,
            "can_manage_reservations",
        )
    if task_data.user_id is not None:
        assigned_user = user_repo.get_user_by_id(db, task_data.user_id)
        if not assigned_user or assigned_user.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned user not found or does not belong to your company",
            )
    _validate_reservation_links(
        db,
        target_location_id,
        task_data.checkout_reservation_id
        if "checkout_reservation_id" in task_data.model_fields_set
        else task.checkout_reservation_id,
        task_data.next_reservation_id
        if "next_reservation_id" in task_data.model_fields_set
        else task.next_reservation_id,
    )
    if "description" in task_data.model_fields_set:
        task_structure_service.validate_description_assignees(
            db,
            task.company_id,
            task_data.description,
        )


def _normalize_task_completion(
    task: TaskItem,
    task_data: TaskItemUpdate,
) -> TaskItemUpdate:
    if task_data.status == "completed":
        description_changed = "description" in task_data.model_fields_set
        prospective_description = (
            task_data.description if description_changed else task.description
        )
        prospective_evidence = (
            task_data.checklist_evidence
            if "checklist_evidence" in task_data.model_fields_set
            else task.checklist_evidence
        )
        has_checklist = bool(
            task_assignment_service.parse_checklist(prospective_description)
            or task.checklist_items
        )
        if description_changed:
            checklist_complete = task_assignment_service.checklist_snapshot_is_complete(
                prospective_description,
                prospective_evidence,
            )
        else:
            checklist_complete = (
                task_assignment_service.all_task_checklist_items_are_complete(task)
            )
        if has_checklist and not checklist_complete:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Complete every checklist item before completing the task",
            )
        task_data = task_data.model_copy(
            update={"date_done": datetime.now(timezone.utc)}
        )
    elif "status" in task_data.model_fields_set and task.status == "completed":
        return task_data.model_copy(update={"date_done": None})
    return task_data


def _should_freeze_external_snapshot(
    task: TaskItem,
    task_data: TaskItemUpdate,
    is_external: bool,
) -> bool:
    return (
        is_external
        and task.status in {"requested", "pending", "accepted"}
        and task_data.status in {"progress", "review", "completed"}
    )


def update_task_item(
    db: Session, current_user: User, task_item_id: int, task_data: TaskItemUpdate
) -> TaskItem:
    db_task_item = _require_mutable_task_for_update(
        db,
        current_user,
        task_item_id,
    )
    was_completed = db_task_item.status == "completed"
    previous_assignee_ids = task_assignment_service.assigned_user_ids(db_task_item)
    is_external = _validate_task_update_scope(
        db,
        db_task_item,
        current_user,
        task_data,
    )
    _validate_task_update_relations(
        db,
        db_task_item,
        current_user,
        task_data,
    )
    task_data = _normalize_task_completion(db_task_item, task_data)

    if _should_freeze_external_snapshot(
        db_task_item,
        task_data,
        is_external,
    ):
        _freeze_live_external_snapshot(db, db_task_item)

    updated_task = task_item_repo.update_task_item(db, db_task_item, task_data)
    if (
        "description" in task_data.model_fields_set
        or "user_id" in task_data.model_fields_set
    ):
        task_structure_service.sync_from_description(db, updated_task)
    _complete_task_when_checklist_is_done(db, updated_task)
    db.commit()
    db.refresh(updated_task)
    _notify_new_task_assignees(
        db,
        updated_task,
        task_assignment_service.assigned_user_ids(updated_task) - previous_assignee_ids,
    )
    calendar_sync_service.enqueue_task_sync(db, updated_task)
    if not was_completed and updated_task.status == "completed":
        task_lifecycle_notification_service.notify_task_completed(db, updated_task)
    return updated_task


def start_task_work(
    db: Session,
    current_user: User,
    task_item_id: int,
    notes: str | None = None,
    start_latitude: float | None = None,
    start_longitude: float | None = None,
    start_accuracy_meters: float | None = None,
) -> TaskItem:
    if start_latitude is None or start_longitude is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A precise start location is required to begin work",
        )
    task = get_task_item(db, current_user, task_item_id)
    if not task_assignment_service.can_viewer_access_task(task, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only start work assigned to you",
        )
    if task.status in {"requested", "rejected", "completed"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This task is not available to start",
        )
    if task.status == "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This task must be accepted by an administrator before starting",
        )
    # Serialize concurrent clock-in requests for the same worker. This keeps
    # double clicks or retried mobile requests from creating overlapping sessions.
    db.query(User).filter(User.id == current_user.id).with_for_update().one()
    active_sessions = work_session_repo.get_active_sessions_by_user(db, current_user.id)
    if active_sessions:
        if all(session.task_item_id == task.id for session in active_sessions):
            for duplicate in active_sessions[1:]:
                duplicate.end_time = duplicate.start_time
                db.add(duplicate)
            updated_description, updated_count = (
                task_assignment_service.set_user_assignment_status(
                    task.description, current_user.id, "progress"
                )
            )
            if updated_count:
                task.description = updated_description
            task_structure_service.set_user_status(task, current_user.id, "progress")
            task.status = "progress"
            task.date_done = None
            db.add(task)
            db.commit()
            db.refresh(task)
            calendar_sync_service.enqueue_task_sync(db, task)
            task_lifecycle_notification_service.notify_work_started(
                db,
                task,
                current_user,
                active_sessions[0],
            )
            return task
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an active session on another task",
        )

    _freeze_live_external_snapshot(db, task)
    updated_description, updated_count = (
        task_assignment_service.set_user_assignment_status(
            task.description, current_user.id, "progress"
        )
    )
    if updated_count:
        task.description = updated_description
    task_structure_service.set_user_status(task, current_user.id, "progress")
    task.status = "progress"
    task.date_done = None

    session = WorkSession(
        user_id=current_user.id,
        location_id=task.location_id,
        task_item_id=task.id,
        notes=notes or f"Started from task: {task.title}",
        start_time=datetime.now(timezone.utc),
        start_latitude=start_latitude,
        start_longitude=start_longitude,
        start_accuracy_meters=start_accuracy_meters,
    )
    db.add(task)
    db.add(session)
    db.commit()
    db.refresh(task)
    calendar_sync_service.enqueue_task_sync(db, task)
    task_lifecycle_notification_service.notify_work_started(
        db,
        task,
        current_user,
        session,
    )
    return task


def accept_task_item(
    db: Session,
    current_user: User,
    task_item_id: int,
    accept_data: TaskAcceptRequest,
) -> TaskItem:
    task = get_task_item(db, current_user, task_item_id)
    if task.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task Item not found",
        )
    if current_user.role.name not in {"admin", "manager"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company administrators or managers can accept requests",
        )
    if task.status != "requested":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only requested tasks can be accepted",
        )
    if task.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the receiving company can accept this request",
        )

    scheduled_start_at = accept_data.scheduled_start_at or task.scheduled_start_at
    if scheduled_start_at and task.checkout_reservation:
        if scheduled_start_at < task.checkout_reservation.check_out_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cleaning cannot be scheduled before the current checkout date.",
            )
    if scheduled_start_at and task.next_reservation:
        if scheduled_start_at > task.next_reservation.check_in_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cleaning must be performed before the next check-in.",
            )

    from app.services import reservation_service

    live_snapshot = reservation_service.get_live_external_task_snapshot(db, task)
    calendar_owner_user_id = resolve_calendar_owner_user_id(
        db,
        task.company_id,
        preferred_user_id=current_user.id,
    )
    task.accepted_by_user_id = current_user.id
    receiver_users = task_lifecycle_notification_service.operational_users(
        db,
        task.company_id,
    )
    assigned_description = task_assignment_service.assign_to_users(
        live_snapshot.get("description", task.description),
        {user.id for user in receiver_users},
    )
    live_snapshot["description"] = assigned_description
    updated_task = task_item_repo.update_task_item(
        db,
        task,
        TaskItemUpdate(
            status="accepted",
            scheduled_start_at=scheduled_start_at,
            user_id=calendar_owner_user_id,
            **live_snapshot,
        ),
    )
    task_structure_service.sync_from_description(db, updated_task)
    if (
        updated_task.checkout_reservation
        and updated_task.checkout_reservation.owner_company_id
        != updated_task.company_id
    ):
        ensure_company_as_client(
            db,
            owner_company_id=updated_task.company_id,
            partner_company=updated_task.checkout_reservation.owner_company,
        )
    db.commit()
    db.refresh(updated_task)
    calendar_sync_service.enqueue_task_sync(db, updated_task)
    notification_service.notify_users(
        db,
        users=receiver_users,
        event_type="task.assigned",
        title="Nueva tarea asignada",
        message=updated_task.title,
        entity_type="task_item",
        entity_id=updated_task.id,
        href=f"/dashboard?taskId={updated_task.id}",
    )
    task_lifecycle_notification_service.notify_request_accepted(
        db,
        updated_task,
        current_user,
    )
    return updated_task


def reject_task_item(
    db: Session,
    current_user: User,
    task_item_id: int,
) -> TaskItem:
    task = get_task_item(db, current_user, task_item_id)
    if current_user.role.name not in {"admin", "manager"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only company administrators or managers can reject requests",
        )
    if task.status != "requested":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only requested tasks can be rejected",
        )
    if task.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the receiving company can reject this request",
        )

    rejected = update_task_item(
        db,
        current_user,
        task_item_id,
        TaskItemUpdate(status="rejected"),
    )
    task_lifecycle_notification_service.notify_request_rejected(
        db,
        rejected,
        current_user,
    )
    return rejected


def _require_finishable_user_assignment(task: TaskItem, user_id: int) -> None:
    if not task_assignment_service.is_user_assigned(task, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only finish work assigned to you",
        )
    if not task_assignment_service.user_checklist_is_complete(
        task,
        user_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete all your assigned checklist items before finishing",
        )


def _active_sessions_for_task(
    db: Session,
    user_id: int,
    task_id: int,
) -> list[WorkSession]:
    return [
        session
        for session in work_session_repo.get_active_sessions_by_user(db, user_id)
        if session.task_item_id == task_id
    ]


def _finish_without_active_session(task: TaskItem, user_id: int) -> TaskItem:
    assignment_status = task_assignment_service.get_user_assignment_status(
        task,
        user_id,
    )
    if task.status == "completed" or assignment_status == "completed":
        return task
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="No active work session exists for this task",
    )


def _complete_user_assignment(task: TaskItem, user_id: int) -> None:
    updated_description, updated_count = (
        task_assignment_service.set_user_assignment_status(
            task.description,
            user_id,
            "completed",
        )
    )
    if updated_count:
        task.description = updated_description
    task_structure_service.set_user_status(task, user_id, "completed")


def _set_task_status_after_user_finish(task: TaskItem) -> None:
    checklist_complete = task_assignment_service.all_task_checklist_items_are_complete(
        task
    )
    has_explicit_assignments = task_assignment_service.has_explicit_assignments(
        task.description
    )
    if checklist_complete or not has_explicit_assignments:
        task.status = "completed"
        task.date_done = datetime.now(timezone.utc)
        return
    task.status = "progress"
    task.date_done = None


def _close_user_task_sessions(
    db: Session,
    active_sessions: list[WorkSession],
) -> None:
    completed_at = datetime.now(timezone.utc)
    for index, active_session in enumerate(active_sessions):
        active_session.end_time = (
            completed_at if index == 0 else active_session.start_time
        )
        db.add(active_session)


def finish_task_work(
    db: Session,
    current_user: User,
    task_item_id: int,
) -> TaskItem:
    task = get_task_item(db, current_user, task_item_id)
    was_completed = task.status == "completed"
    _require_finishable_user_assignment(task, current_user.id)
    active_sessions = _active_sessions_for_task(
        db,
        current_user.id,
        task.id,
    )
    if not active_sessions:
        return _finish_without_active_session(task, current_user.id)

    _complete_user_assignment(task, current_user.id)
    _set_task_status_after_user_finish(task)
    _close_user_task_sessions(db, active_sessions)
    db.add(task)
    db.commit()
    db.refresh(task)
    calendar_sync_service.enqueue_task_sync(db, task)
    if not was_completed and task.status == "completed":
        task_lifecycle_notification_service.notify_task_completed(db, task)
    return task


def update_task_checklist_item(
    db: Session,
    current_user: User,
    task_item_id: int,
    checklist_item_id: int,
    item_data: TaskChecklistItemUpdate,
) -> TaskItem:
    task = get_task_item(db, current_user, task_item_id)
    was_completed = task.status == "completed"
    if task.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task Item not found",
        )
    item = db.get(TaskChecklistItem, checklist_item_id)
    if item is None or item.task_id != task.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checklist item not found",
        )
    if current_user.role.name != "viewer":
        location_access_service.require_location_capability(
            db, current_user, task.location_id, "can_manage_tasks"
        )
    updated = task_structure_service.update_checklist_item(
        db,
        task,
        item,
        current_user,
        item_data.completed,
        item_data.answer,
    )
    if _complete_task_when_checklist_is_done(db, updated):
        db.commit()
        db.refresh(updated)
    calendar_sync_service.enqueue_task_sync(db, updated)
    if not was_completed and updated.status == "completed":
        task_lifecycle_notification_service.notify_task_completed(db, updated)
    return updated


def delete_task_item(db: Session, current_user: User, task_item_id: int) -> None:
    db_task_item = task_item_repo.get_task_item(
        db, current_user.company_id, task_item_id
    )
    if not db_task_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task Item not found"
        )
    if db_task_item.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task Item not found"
        )
    location_access_service.require_location_capability(
        db, current_user, db_task_item.location_id, "can_manage_tasks"
    )
    if db_task_item.is_invoiced:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete an invoiced task item",
        )
    calendar_sync_service.enqueue_task_deletion(db, db_task_item)
    task_item_repo.delete_task_item(db, db_task_item)
    db.commit()
