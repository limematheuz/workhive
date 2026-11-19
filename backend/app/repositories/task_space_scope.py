"""Persistence of the derived structures replaced by an unstarted task scope."""
from datetime import timedelta, timezone
from sqlalchemy.orm import selectinload
from app.models.task_item import TaskItem
from app.models.task_structure import TaskChecklistItem
from app.models.location_zone import LocationSpaceTaskTemplate
from app.models.staff_shift import StaffShift
from app.models.workforce_plan import TaskSpaceStaff, StaffChecklistProgress
from app.repositories import workforce_plan


def utc(value):
    return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)


def task_record(db, company, task_id):
    return db.query(TaskItem).options(selectinload(TaskItem.checklist_items).selectinload(TaskChecklistItem.assignments),
        selectinload(TaskItem.assignments), selectinload(TaskItem.zones)).filter_by(company_id=company, id=task_id).with_for_update(of=TaskItem).populate_existing().first()


def templates(db, ids):
    return db.query(LocationSpaceTaskTemplate).filter(LocationSpaceTaskTemplate.id.in_(ids)).all()


def clear_allocations(db, company, task, allocations):
    ids = [row.id for row in allocations]
    db.query(StaffChecklistProgress).filter(StaffChecklistProgress.allocation_id.in_(ids)).delete(synchronize_session="fetch")
    minutes = {}
    for row in allocations:
        minutes[row.employee_id] = minutes.get(row.employee_id, 0) + (row.planned_minutes or 0)
    # StaffShift has no source column. Remove only the exact generated intervals;
    # a manually adjusted shift survives and participates in overlap validation.
    shifts = db.query(StaffShift).filter_by(company_id=company, task_id=task.id).all()
    for shift in shifts:
        effort = minutes.get(shift.employee_id)
        if effort and task.scheduled_start_at is not None and utc(shift.starts_at) == utc(task.scheduled_start_at) and utc(shift.ends_at) == utc(task.scheduled_start_at) + timedelta(minutes=effort):
            db.delete(shift)
    workforce_plan.allocations(db, company, [task.id]).delete(synchronize_session="fetch")
    db.flush()


def staff_checklist_ids(db, company, task, items):
    if not items:
        return set()
    return {row[0] for row in workforce_plan.task_progress(db, company, task).with_entities(StaffChecklistProgress.checklist_id).filter(StaffChecklistProgress.checklist_id.in_(items)).distinct()}
