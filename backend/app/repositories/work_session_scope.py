from sqlalchemy import select,func,and_,or_
from app.models.work_session import WorkSession
from app.models.task_item import TaskItem
from app.models.user import User
from app.models.reservation import Reservation
from app.models.company import Company


def company_expression():
    task_company=select(TaskItem.company_id).where(TaskItem.id==WorkSession.task_item_id).correlate(WorkSession).scalar_subquery()
    identity_company=select(User.company_id).where(User.id==WorkSession.user_id).correlate(WorkSession).scalar_subquery()
    return func.coalesce(WorkSession.company_id,task_company,WorkSession.labor_cost_company_id,identity_company)


def company_scope(company_id):return company_expression()==company_id


def visible_company_scope(company_id):
    operational=company_expression()
    return or_(operational==company_id,and_(operational!=company_id,TaskItem.company_id==operational,Reservation.owner_company_id==company_id))


def company_for_session(db,row):
    if row.company_id is not None:return row.company_id
    return db.query(company_expression()).filter(WorkSession.id==row.id).scalar()


def company_labels(db,ids):
    if not ids:return {}
    rows=db.query(WorkSession.id,Company.id,Company.name).select_from(WorkSession).outerjoin(Company,Company.id==company_expression()).filter(WorkSession.id.in_(ids)).all()
    return {session:(company,name) for session,company,name in rows}
