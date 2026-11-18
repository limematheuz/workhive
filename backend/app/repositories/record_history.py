from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.staff_employee import StaffEmployee
from app.models.staff_shift import StaffShift
from app.models.staff_absence import StaffAbsence
from sqlalchemy import String, and_, cast, or_, select


def employee(db, company, identifier):
    return db.query(StaffEmployee).filter_by(company_id=company, id=identifier).first()


def events(db, company, entity_type, identifier, offset):
    related = [and_(AuditLog.entity_type == entity_type, AuditLog.entity_id == str(identifier))]
    if entity_type in {"staff_employee", "task_item"}:
        scope = StaffShift.employee_id == identifier if entity_type == "staff_employee" else StaffShift.task_id == identifier
        shifts = select(cast(StaffShift.id, String)).where(StaffShift.company_id == company, scope)
        related.append(and_(AuditLog.entity_type == "staff_shift", AuditLog.entity_id.in_(shifts)))
    if entity_type == "staff_employee":
        absences = select(cast(StaffAbsence.id, String)).where(StaffAbsence.company_id == company, StaffAbsence.employee_id == identifier)
        related.append(and_(AuditLog.entity_type == "staff_absence", AuditLog.entity_id.in_(absences)))
    return db.query(AuditLog, User.full_name).outerjoin(User, User.id == AuditLog.actor_user_id).filter(
        AuditLog.company_id == company, or_(*related),
    ).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).offset(offset).limit(51).all()
