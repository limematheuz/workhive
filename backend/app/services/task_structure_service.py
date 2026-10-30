import re
from collections import defaultdict, deque

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.task_item import TaskItem
from app.models.task_structure import (
    TaskAssignment,
    TaskChecklistAssignment,
    TaskChecklistItem,
)
from app.models.user import User
from app.repositories import user as user_repo
from app.services import task_assignment_service


STATUS_PRIORITY = {
    "pending": 0,
    "accepted": 1,
    "completed": 2,
    "progress": 3,
    "review": 4,
    "rejected": 5,
}


def _key(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().casefold()


def _aggregate_status(statuses: list[str], task_status: str) -> str:
    if not statuses:
        return task_status if task_status in task_assignment_service.WORKER_STATUSES else "pending"
    if all(value == "completed" for value in statuses):
        return "completed"
    return max(statuses, key=lambda value: STATUS_PRIORITY.get(value, 0))


def description_assignee_ids(description: str | None) -> set[int]:
    ids = task_assignment_service.hidden_assignee_ids(description)
    ids.update(
        item.assigned_user_id
        for item in task_assignment_service.parse_checklist(description)
        if item.assigned_user_id is not None
    )
    return ids


def validate_description_assignees(
    db: Session,
    company_id: int,
    description: str | None,
) -> None:
    validate_assignee_ids(db, company_id, description_assignee_ids(description))


def validate_assignee_ids(db: Session, company_id: int, ids: set[int]) -> None:
    if not ids:
        return
    valid_ids = user_repo.get_active_company_user_ids(db, company_id, ids)
    if valid_ids != ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Checklist assignees must be active users in the task company",
        )


def sync_from_description(
    db: Session,
    task: TaskItem,
    *,
    strict: bool = True,
    include_embedded_assignments: bool = True,
) -> TaskItem:
    if strict:
        validate_description_assignees(db, task.company_id, task.description)

    company_users = {
        user.id: user
        for user in db.query(User).filter(
            User.company_id == task.company_id,
            User.is_active.is_(True),
        )
    }
    existing_by_text: dict[str, deque[TaskChecklistItem]] = defaultdict(deque)
    for existing in list(task.checklist_items):
        existing_by_text[_key(existing.text)].append(existing)
        existing.position += 1_000_000
    if task.checklist_items:
        db.flush()

    parsed_rows: list[tuple[int, object]] = []
    for line_index, line in enumerate((task.description or "").splitlines()):
        parsed = task_assignment_service.parse_checklist_line(line)
        if parsed is not None:
            parsed_rows.append((line_index, parsed))

    retained: list[TaskChecklistItem] = []
    user_statuses: dict[int, list[str]] = defaultdict(list)
    explicit_ids: set[int] = set()
    for position, (line_index, parsed) in enumerate(parsed_rows):
        matches = existing_by_text.get(_key(parsed.text))
        item = matches.popleft() if matches else TaskChecklistItem(task=task)
        item.position = position
        item.source_line_index = line_index
        item.text = parsed.text
        item.completed = bool(parsed.checked or parsed.assigned_status == "completed")

        user_id = parsed.assigned_user_id if include_embedded_assignments else None
        current_item_assignments = {
            assignment.user_id: assignment for assignment in item.assignments
        }
        if user_id is not None and user_id in company_users:
            worker_status = parsed.assigned_status or ("completed" if item.completed else "pending")
            item.assignments[:] = [
                current_item_assignments.get(user_id)
                or TaskChecklistAssignment(user_id=user_id)
            ]
            item.assignments[0].status = worker_status
            explicit_ids.add(user_id)
            user_statuses[user_id].append(worker_status)
        else:
            item.assignments.clear()
        retained.append(item)

    retained_ids = {id(item) for item in retained}
    for existing in list(task.checklist_items):
        if id(existing) not in retained_ids:
            task.checklist_items.remove(existing)
    task.checklist_items[:] = retained

    assignment_data: dict[int, tuple[str, str]] = {}
    for user_id in explicit_ids:
        assignment_data[user_id] = (
            _aggregate_status(user_statuses[user_id], task.status),
            "checklist",
        )
    if include_embedded_assignments:
        for user_id in task_assignment_service.hidden_assignee_ids(task.description):
            if user_id in company_users:
                assignment_data.setdefault(user_id, (task.status, "all"))
    if task.user_id in company_users:
        assignment_data.setdefault(task.user_id, (task.status, "direct"))

    existing_assignments = {assignment.user_id: assignment for assignment in task.assignments}
    next_assignments: list[TaskAssignment] = []
    for user_id, (worker_status, source) in sorted(assignment_data.items()):
        assignment = existing_assignments.get(user_id) or TaskAssignment(user_id=user_id)
        assignment.status = worker_status
        assignment.source = source
        next_assignments.append(assignment)
    task.assignments[:] = next_assignments

    db.add(task)
    db.flush()
    evidence = dict(task.checklist_evidence or {})
    for item in retained:
        legacy_key = f"parsed_{item.position + 1}"
        stable_key = f"item_{item.id}"
        if stable_key not in evidence and legacy_key in evidence:
            evidence[stable_key] = evidence[legacy_key]
    task.checklist_evidence = evidence
    db.add(task)
    db.flush()
    return task


def copy_pending_structure(db: Session, source: TaskItem, target: TaskItem) -> None:
    """Copy the stored work definition, including steps absent from markdown."""
    if source.checklist_items:
        target.checklist_items.clear()
        db.flush()
        target.checklist_items = [
            TaskChecklistItem(
                position=item.position, source_line_index=item.source_line_index,
                location_space_task_template_id=item.location_space_task_template_id,
                space_name=item.space_name, text=item.text, completed=False,
                assignments=[
                    TaskChecklistAssignment(user_id=assignment.user_id, status="pending")
                    for assignment in item.assignments
                ],
            )
            for item in source.checklist_items
        ]
    if source.assignments:
        target.assignments.clear()
        db.flush()
        target.assignments = [
            TaskAssignment(user_id=assignment.user_id, source=assignment.source, status="pending")
            for assignment in source.assignments
        ]
    db.flush()


def set_user_status(task: TaskItem, user_id: int, next_status: str) -> None:
    for assignment in task.assignments:
        if assignment.user_id == user_id:
            assignment.status = next_status
    for item in task.checklist_items:
        for assignment in item.assignments:
            if assignment.user_id == user_id:
                assignment.status = next_status


def update_checklist_item(
    db: Session,
    task: TaskItem,
    item: TaskChecklistItem,
    current_user: User,
    completed: bool,
    answer: str | None = None,
) -> TaskItem:
    if item.task_id != task.id:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    current_assignment = next(
        (
            assignment
            for assignment in task.assignments
            if assignment.user_id == current_user.id
        ),
        None,
    )
    owns_explicit_item = any(
        assignment.user_id == current_user.id for assignment in item.assignments
    )
    owns_shared_item = current_assignment is not None and (
        current_assignment.source == "all"
        or (
            current_assignment.source == "direct"
            and not item.assignments
        )
    )
    if (
        current_user.role.name == "viewer"
        and not owns_explicit_item
        and not owns_shared_item
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Field workers can only update their assigned checklist items",
        )

    item.completed = completed
    for assignment in item.assignments:
        if current_user.role.name != "viewer" or assignment.user_id == current_user.id:
            assignment.status = "completed" if completed else "pending"

    lines = (task.description or "").splitlines()
    if item.source_line_index is not None and item.source_line_index < len(lines):
        parsed = task_assignment_service.parse_checklist_line(lines[item.source_line_index])
        if parsed:
            box = "x" if completed and answer != "no" else " "
            name = f":{parsed.assigned_user_name}" if parsed.assigned_user_name else ""
            worker_status = "completed" if completed else "pending"
            suffix = (
                f" (@{parsed.assigned_user_id}{name}:{worker_status})"
                if parsed.assigned_user_id is not None
                else ""
            )
            lines[item.source_line_index] = (
                f"{parsed.prefix}{box}{parsed.closing}{parsed.text}{suffix}"
            )
            task.description = "\n".join(lines)

    evidence = dict(task.checklist_evidence or {})
    evidence_key = f"item_{item.id}"
    evidence[evidence_key] = {
        **(evidence.get(evidence_key) or {}),
        "answer": answer or ("yes" if completed else None),
    }
    task.checklist_evidence = evidence
    for task_assignment in task.assignments:
        if task_assignment.source == "all":
            assigned_items = list(task.checklist_items)
        elif task_assignment.source == "direct":
            assigned_items = [
                checklist_item
                for checklist_item in task.checklist_items
                if not checklist_item.assignments
            ]
        else:
            assigned_items = [
                checklist_item
                for checklist_item in task.checklist_items
                if any(
                    assignment.user_id == task_assignment.user_id
                    for assignment in checklist_item.assignments
                )
            ]
        if assigned_items:
            task_assignment.status = (
                "completed"
                if all(checklist_item.completed for checklist_item in assigned_items)
                else "progress"
            )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task
