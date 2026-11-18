from app.models.staff_absence import StaffAbsence, StaffReservationDay
from app.models.staff_employee import StaffEmployee


def list_absences(db, company):
    return db.query(StaffAbsence).filter_by(company_id=company).order_by(StaffAbsence.starts_on.desc()).all()


def lock_people(db, company, people):
    return db.query(StaffEmployee).filter(StaffEmployee.company_id == company, StaffEmployee.id.in_(people)).order_by(StaffEmployee.id).with_for_update().all()


def absence(db, company, record_id):
    return db.query(StaffAbsence).filter_by(company_id=company, id=record_id).with_for_update().first()


def clear_days(db, absence_id):
    db.query(StaffReservationDay).filter_by(absence_id=absence_id).delete()
