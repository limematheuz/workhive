"""Authorization and state-transition policy for mutable task work orders.

This module deliberately contains validation only. Persisting a task, syncing a
calendar, creating notifications, and billing snapshots remain orchestration
concerns of :mod:`task_item_service`.
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.task_item import TaskItem
from app.models.user import User
from app.repositories import reservation as reservation_repo
from app.repositories import task_item as task_item_repo
from app.repositories import user as user_repo
from app.schemas.task_item import TaskItemUpdate
from app.services import (
    location_access_service,
    task_assignment_service,
    task_structure_service,
)


def validate_reservation_links(
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


def require_mutable_task_for_update(
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


def is_external_reservation_task(task: TaskItem, current_user: User) -> bool:
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
            "pricing_mode",
            "quantity",
            "unit",
            "user_id",
            "scheduled_start_at",
            "status",
            "date_done",
            "zone_ids",
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


def validate_task_update_scope(
    db: Session,
    task: TaskItem,
    current_user: User,
    task_data: TaskItemUpdate,
) -> bool:
    _validate_task_report_fields(task_data)
    is_external = is_external_reservation_task(task, current_user)
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


def validate_task_update_relations(
    db: Session,
    task: TaskItem,
    current_user: User,
    task_data: TaskItemUpdate,
) -> None:
    target_location_id = task_data.location_id or task.location_id
    if task_data.location_id is not None:
        location_access_service.require_location_capability(
            db,
            current_user,
            task_data.location_id,
            "can_manage_tasks",
        )
    if {"checkout_reservation_id", "next_reservation_id"} & task_data.model_fields_set:
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
    validate_reservation_links(
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


def normalize_task_completion(
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
            checklist_complete = task_assignment_service.all_task_checklist_items_are_complete(
                task
            )
        if has_checklist and not checklist_complete:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Complete every checklist item before completing the task",
            )
        return task_data.model_copy(
            update={"date_done": datetime.now(timezone.utc)}
        )
    if "status" in task_data.model_fields_set and task.status == "completed":
        return task_data.model_copy(update={"date_done": None})
    return task_data


def should_freeze_external_snapshot(
    task: TaskItem,
    task_data: TaskItemUpdate,
    is_external: bool,
) -> bool:
    return (
        is_external
        and task.status in {"requested", "pending", "accepted"}
        and task_data.status in {"progress", "review", "completed"}
    )
