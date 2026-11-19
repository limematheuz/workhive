from sqlalchemy import or_
from app.models.advisory_access import AdvisoryAccess
from app.models.external_access_grant import ExternalAccessGrant
from app.models.user import User
from app.models.company import Company
from app.models.staff_employee import StaffEmployee
from app.models.staff_absence import StaffAbsence
from app.models.service_hours_review import ServiceHoursReview
from app.models.task_item import TaskItem


def grants(db, user_id, now, *, grant_id=None):
    query = db.query(ExternalAccessGrant).filter(
        ExternalAccessGrant.user_id == user_id, ExternalAccessGrant.access_type == "accountant",
        ExternalAccessGrant.status == "active",
        or_(ExternalAccessGrant.expires_at.is_(None), ExternalAccessGrant.expires_at > now))
    return query.filter(ExternalAccessGrant.id == grant_id) if grant_id is not None else query


def company_grants(db, company):
    return db.query(ExternalAccessGrant, User).join(User, User.id == ExternalAccessGrant.user_id).filter(
        ExternalAccessGrant.company_id == company, ExternalAccessGrant.access_type == "accountant").all()


def find_user(db, email):
    return db.query(User).filter_by(email=email, is_active=True).first()


def grant_for_user(db, company, user_id):
    return db.query(ExternalAccessGrant).filter_by(company_id=company, user_id=user_id, access_type="accountant").first()


def area(db, grant_id):
    return db.get(AdvisoryAccess, grant_id)


def company(db, company_id):
    return db.get(Company, company_id)


def company_name(db, company_id):
    row = company(db, company_id)
    return row.name if row else str(company_id)


def payroll_data(db, company, starts, ends):
    staff = db.query(StaffEmployee).filter_by(company_id=company).all()
    absences = db.query(StaffAbsence).filter(StaffAbsence.company_id == company, StaffAbsence.ends_on >= starts,
                                          StaffAbsence.starts_on < ends).all()
    return staff, absences

def approved_variables(db,company,starts,ends):
    from app.models.internal_request import InternalRequest
    return db.query(InternalRequest).filter(InternalRequest.company_id==company,
        InternalRequest.status=="approved",InternalRequest.kind.in_(["advance","extra_hours"]),
        InternalRequest.starts_on>=starts,InternalRequest.starts_on<ends).all()
