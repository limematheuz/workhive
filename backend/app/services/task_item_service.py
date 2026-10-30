from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import status, HTTPException
from app.models.task_item import TaskItem
from app.schemas.task_item import (
    TaskAcceptRequest,
    TaskItemCreate,
    TaskItemUpdate,
    TaskChecklistItemUpdate,
)
from app.repositories import task_item as task_item_repo
from app.repositories import service_catalog_version as service_catalog_version_repo
from app.repositories import template_task as template_task_repo
from app.services import location_access_service
from app.services.organization_authorization_service import require_capability
from app.models.user import User
from app.models.work_session import WorkSession
from app.repositories import work_session as work_session_repo
from app.services import (
    calendar_sync_service,
    notification_service,
    task_assignment_service,
    task_billing_service,
    task_completion_service,
    task_lifecycle_notification_service,
    location_zone_service,
    location_workspace_service,
    task_structure_service,
    task_update_policy_service,
)
from app.services.company_client_service import ensure_company_as_client
from app.models.task_structure import TaskChecklistItem
from app.services.calendar_task_owner_service import resolve_calendar_owner_user_id
from app.services.task_work_completion_service import (
    complete_task_when_checklist_is_done as _complete_task_when_checklist_is_done,
    finish_task_work,  # noqa: F401 - public compatibility re-export
    require_work_orders_feature as _require_work_orders_feature,
)
from app.services.task_work_activity_service import has_recorded_activity
from app.services.work_session_pause_service import close_open_pause
from app.services.task_item_read_service import (
    build_loaded_task_response,  # noqa: F401 - public compatibility re-export
    build_task_response,  # noqa: F401 - public compatibility re-export
    get_task_item,
    get_task_item_async,  # noqa: F401 - public compatibility re-export
    get_task_items,  # noqa: F401 - public compatibility re-export
    get_task_items_async,  # noqa: F401 - public compatibility re-export
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


def _resolve_current_catalog_version_id(
    db: Session,
    *,
    template_task_id: int,
    company_id: int | None,
) -> int:
    """Resolve an active service in the caller's company to its immutable revision."""
    template = template_task_repo.get_template_task_by_id(
        db,
        template_task_id,
        company_id,
    )
    if not template or not template.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service catalog entry not found",
        )

    version = service_catalog_version_repo.get_current_for_template(
        db,
        template_task_id=template.id,
        version=template.catalog_version,
    )
    # The migration creates this record for every legacy template. Keeping this
    # repair path protects a partially migrated local database without ever
    # altering an existing immutable version.
    if version is None:
        version = service_catalog_version_repo.create_from_template(db, template)
    return version.id


def create_task_item(
    db: Session,
    current_user: User,
    task_item_data: TaskItemCreate,
    *,
    work_order_id: int | None = None,
    checklist_source: TaskItem | None = None,
) -> TaskItem:
    _require_work_orders_feature(db, current_user)
    location_access_service.require_location_capability(
        db,
        current_user,
        task_item_data.location_id,
        "can_manage_tasks",
        permission_code="work.manage",
    )
    task_update_policy_service.validate_direct_assignee(
        db, current_user.company_id, task_item_data.user_id,
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
    task_update_policy_service.validate_reservation_links(
        db,
        task_item_data.location_id,
        task_item_data.checkout_reservation_id,
        task_item_data.next_reservation_id,
    )
    selected_space_ids = location_workspace_service.resolve_task_space_ids(
        task_item_data.zone_ids,
        task_item_data.space_ids,
    )
    location_workspace_service.validate_task_space_ids(
        db,
        task_item_data.location_id,
        selected_space_ids,
    )
    selected_space_task_templates = (
        location_workspace_service.validate_space_task_template_ids(
            db,
            task_item_data.location_id,
            selected_space_ids,
            task_item_data.space_task_template_ids,
        )
    )
    task_structure_service.validate_description_assignees(
        db,
        current_user.company_id,
        task_item_data.description,
    )
    service_catalog_version_id = None
    if task_item_data.template_task_id is not None:
        service_catalog_version_id = _resolve_current_catalog_version_id(
            db,
            template_task_id=task_item_data.template_task_id,
            company_id=current_user.company_id,
        )
    # Manual work starts in the pending column. External company requests are
    # created by the reservation flow and remain requested.
    pricing_mode = task_billing_service.normalize_pricing_mode(
        task_item_data.pricing_mode
    )
    task_item_data = task_item_data.model_copy(
        update={
            "status": "pending",
            "pricing_mode": pricing_mode,
            "unit": (
                "hour"
                if pricing_mode == task_billing_service.PRICING_MODE_HOURLY
                else task_item_data.unit
            ),
            "operational_notes": [],
            "attachments": [],
            "reported_issues": [],
        }
    )
    task = task_item_repo.create_task_item(
        db,
        current_user.company_id,
        task_item_data,
        service_catalog_version_id=service_catalog_version_id,
        work_order_id=work_order_id,
    )
    location_zone_service.sync_task_zones(
        db,
        task.id,
        task.location_id,
        selected_space_ids,
    )
    task_structure_service.sync_from_description(db, task)
    location_workspace_service.append_selected_space_tasks_to_checklist(
        db,
        task,
        selected_space_task_templates,
    )
    if checklist_source is not None:
        task_structure_service.copy_pending_structure(db, checklist_source, task)
    _complete_task_when_checklist_is_done(db, task)
    db.commit()
    db.refresh(task)
    task_lifecycle_notification_service.notify_task_assignees(
        db,
        task,
        task_assignment_service.assigned_user_ids(task),
    )
    calendar_sync_service.enqueue_task_sync(db, task)
    return task


def update_task_item(
    db: Session, current_user: User, task_item_id: int, task_data: TaskItemUpdate
) -> TaskItem:
    _require_work_orders_feature(db, current_user)
    db_task_item = task_update_policy_service.require_mutable_task_for_update(
        db,
        current_user,
        task_item_id,
    )
    was_completed = db_task_item.status == "completed"
    previous_assignee_ids = task_assignment_service.assigned_user_ids(db_task_item)
    is_external = task_update_policy_service.validate_task_update_scope(
        db,
        db_task_item,
        current_user,
        task_data,
    )
    task_update_policy_service.validate_task_update_relations(
        db,
        db_task_item,
        current_user,
        task_data,
    )
    target_location_id = task_data.location_id or db_task_item.location_id
    space_fields_present = {"zone_ids", "space_ids"} & task_data.model_fields_set
    selected_space_ids: list[int] | None = None
    if space_fields_present:
        selected_space_ids = location_workspace_service.resolve_task_space_ids(
            task_data.zone_ids or [],
            task_data.space_ids or [],
        )
        location_workspace_service.validate_task_space_ids(
            db,
            target_location_id,
            selected_space_ids,
        )
    elif task_data.location_id is not None and task_data.location_id != db_task_item.location_id and db_task_item.zones:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Update the selected spaces when changing the task location",
        )
    task_data = task_update_policy_service.normalize_task_completion(
        db_task_item,
        task_data,
    )
    if "pricing_mode" in task_data.model_fields_set and task_data.pricing_mode is not None:
        mode = task_billing_service.normalize_pricing_mode(task_data.pricing_mode)
        updates = {"pricing_mode": mode}
        if mode == task_billing_service.PRICING_MODE_HOURLY:
            updates["unit"] = "hour"
        task_data = task_data.model_copy(update=updates)

    structure_changed = any(
        field in task_data.model_fields_set
        and getattr(task_data, field) != getattr(db_task_item, field)
        for field in ("description", "user_id")
    )

    if task_update_policy_service.should_freeze_external_snapshot(
        db_task_item,
        task_data,
        is_external,
    ):
        _freeze_live_external_snapshot(db, db_task_item)

    if "template_task_id" in task_data.model_fields_set:
        db_task_item.service_catalog_version_id = (
            _resolve_current_catalog_version_id(
                db,
                template_task_id=task_data.template_task_id,
                company_id=current_user.company_id,
            )
            if task_data.template_task_id is not None
            else None
        )

    pricing_updates = task_data.model_dump(exclude_unset=True)
    task_billing_service.validate_pricing_update(db_task_item, pricing_updates)
    if task_data.status in {"progress", "review", "completed"}:
        task_billing_service.lock_task_pricing(
            db_task_item,
            updates=pricing_updates,
        )

    updated_task = task_item_repo.update_task_item(db, db_task_item, task_data)
    if selected_space_ids is not None:
        location_zone_service.sync_task_zones(
            db,
            updated_task.id,
            updated_task.location_id,
            selected_space_ids,
        )
    if structure_changed:
        task_structure_service.sync_from_description(db, updated_task)
    _complete_task_when_checklist_is_done(db, updated_task)
    task_completion_service.apply_update_side_effects(
        db,
        updated_task,
        was_completed=was_completed,
    )
    db.commit()
    db.refresh(updated_task)
    task_lifecycle_notification_service.notify_task_assignees(
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
    _require_work_orders_feature(db, current_user)
    if start_latitude is None or start_longitude is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A precise start location is required to begin work",
        )
    task = get_task_item(db, current_user, task_item_id)
    require_capability(
        db,
        current_user,
        "time.manage",
        scope_type="location",
        scope_id=task.location_id,
    )
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
                close_open_pause(db, duplicate, duplicate.end_time)
                db.add(duplicate)
            updated_description, updated_count = (
                task_assignment_service.set_user_assignment_status(
                    task.description, current_user.id, "progress"
                )
            )
            if updated_count:
                task.description = updated_description
            task_structure_service.set_user_status(task, current_user.id, "progress")
            _freeze_live_external_snapshot(db, task)
            task_billing_service.lock_task_pricing(task)
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
    task_billing_service.lock_task_pricing(task)
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
    _require_work_orders_feature(db, current_user)
    task = get_task_item(db, current_user, task_item_id)
    if task.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task Item not found",
        )
    require_capability(
        db,
        current_user,
        "work.manage",
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
    acceptance_pricing = accept_data.model_dump(
        exclude_unset=True,
        exclude={"scheduled_start_at"},
    )
    live_snapshot.update(acceptance_pricing)
    has_receiver_pricing_input = bool(acceptance_pricing)
    has_issuer_pricing = live_snapshot.get("price") is not None
    if has_receiver_pricing_input or has_issuer_pricing:
        pricing_mode = task_billing_service.normalize_pricing_mode(
            live_snapshot.get("pricing_mode")
        )
        price, quantity, unit = task_billing_service.validate_pricing_terms(
            pricing_mode,
            live_snapshot.get("price"),
            live_snapshot.get("quantity"),
            live_snapshot.get("unit"),
        )
        live_snapshot.update(
            {
                "pricing_mode": pricing_mode,
                "price": price,
                "quantity": quantity,
                "unit": unit,
            }
        )
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
    _require_work_orders_feature(db, current_user)
    task = get_task_item(db, current_user, task_item_id)
    require_capability(
        db,
        current_user,
        "work.manage",
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


def update_task_checklist_item(
    db: Session,
    current_user: User,
    task_item_id: int,
    checklist_item_id: int,
    item_data: TaskChecklistItemUpdate,
) -> TaskItem:
    _require_work_orders_feature(db, current_user)
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
    if not task_update_policy_service.can_manage_task_at_location(
        db,
        current_user,
        task.location_id,
    ):
        require_capability(
            db,
            current_user,
            "time.manage",
            scope_type="location",
            scope_id=task.location_id,
        )
        task_update_policy_service.require_active_task_session(db, task, current_user)
    else:
        location_access_service.require_location_capability(
            db,
            current_user,
            task.location_id,
            "can_manage_tasks",
            permission_code="work.manage",
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
    _require_work_orders_feature(db, current_user)
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
        db,
        current_user,
        db_task_item.location_id,
        "can_manage_tasks",
        permission_code="work.manage",
    )
    if db_task_item.is_invoiced:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete an invoiced task item",
        )
    if db_task_item.checkout_reservation_id is not None and has_recorded_activity(
        db, db_task_item
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "RESERVATION_TASK_HAS_RECORDED_WORK",
                "message": "Recorded work must remain linked to its reservation.",
            },
        )
    calendar_sync_service.enqueue_task_deletion(db, db_task_item)
    task_item_repo.delete_task_item(db, db_task_item)
    db.commit()
