from app.models.staff_account import StaffAccount,StaffDocumentReceipt
from app.models.staff_employee import StaffEmployee
from app.models.user import User
from app.repositories.company_membership_scope import active_member_predicate


def user_by_email(db,company,email):
    return db.query(User).filter(User.email==email,User.is_active.is_(True),active_member_predicate(company)).first()


def employee_link(db,company,employee_id):
    return db.query(StaffAccount).filter_by(company_id=company,employee_id=employee_id).first()


def own_employee(db,company,user_id):
    return db.query(StaffEmployee).join(StaffAccount,StaffAccount.employee_id==StaffEmployee.id).filter(
        StaffEmployee.company_id==company,StaffAccount.user_id==user_id).first()


def receipts(db,employee_ids):
    return db.query(StaffDocumentReceipt).filter(StaffDocumentReceipt.employee_id.in_(employee_ids)).all()

def historical_hourly_cost(db, company, user_id, worked_on):
    from decimal import Decimal
    employee = own_employee(db,company,user_id)
    history = employee.history if employee else None
    periods = [key for key in (history or {}) if key <= worked_on.isoformat()[:7]]
    if not periods:
        return None
    period = history[max(periods)]
    hours = Decimal(period.get("hours","0"))
    cost=Decimal(period["cost"])
    if hours>0 and cost>0:return cost/hours
    if max(periods)==max(history) and employee.hourly_cost and employee.hourly_cost>0:return Decimal(employee.hourly_cost)
    return None
