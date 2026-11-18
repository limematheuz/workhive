from app.models.staff_shift import StaffShift
from app.models.staff_absence import StaffAbsence
from app.models.task_item import TaskItem


def shifts(db, company):
    return db.query(StaffShift).filter_by(company_id=company)


def absences(db, company):
    return db.query(StaffAbsence).filter_by(company_id=company).all()


def task(db, company, task_id):
    return db.query(TaskItem).filter_by(company_id=company, id=task_id).first()
