from sqlalchemy.orm import joinedload
from app.models.task_item import TaskItem
from app.models.work_session import WorkSession
from app.models.service_hours_review import ServiceHoursReview
from app.models.work_order import WorkOrder


def tasks(db, company, locations):
    query = db.query(TaskItem).filter(TaskItem.company_id == company)
    return query if locations is None else query.filter(TaskItem.location_id.in_(locations))


def sessions(db, ids):
    return db.query(WorkSession).filter(WorkSession.task_item_id.in_(ids)).all()


def reviews(db, ids):
    return db.query(ServiceHoursReview).filter(ServiceHoursReview.task_id.in_(ids)).all()


def orders(db, company, ids):
    return db.query(WorkOrder).filter(WorkOrder.id.in_(ids), WorkOrder.company_id == company).all()


def approved_entries(db, allowed_tasks, start, end):
    candidates = (
        allowed_tasks.with_entities(TaskItem.id)
        .join(ServiceHoursReview, ServiceHoursReview.task_id == TaskItem.id)
        .join(WorkSession, WorkSession.task_item_id == TaskItem.id)
        .filter(ServiceHoursReview.approved_seconds.isnot(None),
                WorkSession.end_time >= start, WorkSession.end_time < end)
        .distinct().subquery()
    )
    sessions = (db.query(WorkSession, ServiceHoursReview, TaskItem.title)
                .join(candidates, candidates.c.id == WorkSession.task_item_id)
                .join(ServiceHoursReview, ServiceHoursReview.task_id == WorkSession.task_item_id)
                .join(TaskItem, TaskItem.id == WorkSession.task_item_id)
                .options(joinedload(WorkSession.user))
                .order_by(WorkSession.task_item_id, WorkSession.id))
    return sessions

def planned_minutes(db, company, task_ids):
    from app.models.staff_shift import StaffShift
    from datetime import timezone
    totals = {}
    for shift in db.query(StaffShift).filter(StaffShift.company_id==company, StaffShift.task_id.in_(task_ids)):
        totals[shift.task_id] = totals.get(shift.task_id,0) + (shift.ends_at-shift.starts_at).total_seconds()/60
    return totals
