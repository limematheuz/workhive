"""Create new work from an authorized stored definition, without execution history."""

import re

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.task_item import TaskItem
from app.models.user import User
from app.repositories import task_item as task_repo
from app.schemas.task_item import TaskItemCreate
from app.services import (
    location_access_service,
    task_assignment_service,
    task_structure_service,
)
from app.services.entitlement_service import require_company_feature
from app.services.task_item_service import create_task_item


def pending_description(description: str | None) -> str | None:
    if not description:
        return None
    lines = description.split("\n")
    for index, line in enumerate(lines):
        parsed = task_assignment_service.parse_checklist_line(line)
        if parsed is None:
            continue
        line = re.sub(r"^(\s*[-*]?\s*\[)\s*[xX\s]\s*(\])", r"\1 \2", line)
        if parsed.assigned_status:
            line = re.sub(
                r":\s*" + re.escape(parsed.assigned_status) + r"(\s*\)\s*)$",
                r":pending\1",
                line,
            )
        lines[index] = line
    return "\n".join(lines)


def duplicate_task_item(db: Session, current_user: User, task_id: int) -> TaskItem:
    if current_user.company_id is None:
        raise HTTPException(status_code=404, detail="Task Item not found")
    require_company_feature(
        db, company_id=current_user.company_id, code="features.work_orders"
    )
    source = task_repo.get_task_with_structure(db, current_user.company_id, task_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Task Item not found")
    location_access_service.require_location_capability(
        db,
        current_user,
        source.location_id,
        "can_manage_tasks",
        permission_code="work.manage",
    )
    if source.is_invoiced:
        raise HTTPException(
            status_code=409, detail="Invoiced tasks cannot be duplicated"
        )
    assignee_ids = task_structure_service.description_assignee_ids(source.description)
    assignee_ids.update(assignment.user_id for assignment in source.assignments)
    assignee_ids.update(
        assignment.user_id
        for item in source.checklist_items
        for assignment in item.assignments
    )
    if source.user_id is not None:
        assignee_ids.add(source.user_id)
    task_structure_service.validate_assignee_ids(db, source.company_id, assignee_ids)
    payload = TaskItemCreate(
        title=f"{source.title} (Copia)",
        description=pending_description(source.description),
        notes=source.notes,
        price=source.price,
        quantity=source.quantity,
        unit=source.unit or "unidad",
        pricing_mode=source.pricing_mode or "fixed",
        template_task_id=source.template_task_id,
        location_id=source.location_id,
        user_id=source.user_id,
        priority=source.priority or "medium",
        zone_ids=[zone.zone_id for zone in source.zones],
    )
    task = create_task_item(db, current_user, payload, checklist_source=source)
    return task_repo.get_task_with_structure(db, current_user.company_id, task.id)
