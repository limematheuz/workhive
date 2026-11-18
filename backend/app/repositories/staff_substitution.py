from sqlalchemy import or_
from app.models.staff_employee import StaffEmployee
from app.models.staff_absence import StaffAbsence
from app.models.staff_shift import StaffShift
from app.models.task_item import TaskItem


def people_page(db, company, offset):
    return db.query(StaffEmployee).filter_by(company_id=company).order_by(StaffEmployee.name, StaffEmployee.id).offset(offset).limit(101).all()


def overlapping_absences(db, company, ids, first, last):
    return db.query(StaffAbsence).filter(
        StaffAbsence.company_id == company, StaffAbsence.starts_on <= last, StaffAbsence.ends_on >= first,
        or_(StaffAbsence.employee_id.in_(ids), StaffAbsence.substitute_id.in_(ids)),
    ).limit(1001).all()


def overlapping_shifts(db, company, ids, start, end):
    return db.query(StaffShift).filter(
        StaffShift.company_id == company, StaffShift.employee_id.in_(ids),
        StaffShift.starts_at < end, StaffShift.ends_at > start,
    ).limit(2001).all()


def coverage_shifts(db, company, employee, start, end):
    return db.query(StaffShift).filter(
        StaffShift.company_id == company, StaffShift.employee_id == employee,
        StaffShift.starts_at < end, StaffShift.ends_at > start,
    ).order_by(StaffShift.starts_at).limit(1001).all()


def locked_tasks(db, company, ids):
    return db.query(TaskItem.id).filter(TaskItem.company_id == company, TaskItem.id.in_(ids),
        or_(TaskItem.status.in_(["progress", "review", "completed"]), TaskItem.work_sessions.any())).first() is not None
