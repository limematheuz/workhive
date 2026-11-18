from app.models.offline_work import OfflineWork
from app.models.task_item import TaskItem
from app.models.work_session import WorkSession
from app.models.user import User


def task(db, company, task_id):
    return db.query(TaskItem).filter_by(company_id=company,id=task_id).with_for_update().first()


def by_event(db, user_id, event):
    return db.query(OfflineWork).filter_by(user_id=user_id,event_id=event).first()


def rows(db, company, locations=None, user_id=None):
    query = db.query(OfflineWork).join(TaskItem,TaskItem.id==OfflineWork.task_id).filter(OfflineWork.company_id==company)
    if locations is not None:
        query = query.filter(TaskItem.location_id.in_(locations))
    if user_id is not None:
        query = query.filter(OfflineWork.user_id==user_id)
    return query


def lock_user(db, user_id):
    return db.query(User).filter_by(id=user_id).with_for_update().one()


def overlaps(db, user_id, start, end):
    return db.query(WorkSession).filter(WorkSession.user_id==user_id,WorkSession.start_time<end,
        (WorkSession.end_time.is_(None)) | (WorkSession.end_time>start)).first() is not None
