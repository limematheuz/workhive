"""Storage boundaries for explicitly published execution parts."""
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from app.models.task_item import TaskItem
from app.models.location import Location
from app.models.task_report import TaskReport
from app.models.client_portal_grant import ClientPortalGrant
from app.models.work_session import WorkSession
from app.models.task_client_publication import TaskClientPublication as Publication, TaskClientPublicationPhoto, TaskClientAcceptance


def task(db, company, task_id):
    return db.query(TaskItem).options(selectinload(TaskItem.location).selectinload(Location.client),
        selectinload(TaskItem.checklist_items)).filter_by(company_id=company, id=task_id).with_for_update(of=TaskItem).populate_existing().first()


def reports(db, company, task_id):
    return db.query(TaskReport).filter_by(task_item_id=task_id, reporter_company_id=company).order_by(TaskReport.id.desc()).limit(201).all()


def work_times(db, task_id):
    return db.query(func.min(WorkSession.start_time), func.count(WorkSession.id)).filter(WorkSession.task_item_id == task_id).one(), db.query(WorkSession.id).filter(WorkSession.task_item_id == task_id, WorkSession.end_time.is_(None)).first() is not None


def latest(db, company, task_id):
    return db.query(Publication).options(selectinload(Publication.acceptance)).filter_by(company_id=company, task_id=task_id).order_by(Publication.revision.desc()).first()


def latest_ids(db, company):
    return db.query(Publication.task_id.label("task"), func.max(Publication.revision).label("revision")).filter_by(company_id=company).group_by(Publication.task_id).subquery()


def scoped(db, grant, *, current=True):
    query = db.query(Publication).options(selectinload(Publication.acceptance)).join(TaskItem,
        (TaskItem.id == Publication.task_id) & (TaskItem.company_id == Publication.company_id) & (TaskItem.location_id == Publication.location_id)).join(Location,
        (Location.id == Publication.location_id) & (Location.client_id == grant.client_id)).filter(
        Publication.company_id == grant.company_id, Publication.client_id == grant.client_id,
        Publication.revoked_at.is_(None), Location.is_active.is_(True))
    if current:
        latest_versions = latest_ids(db, grant.company_id)
        query = query.join(latest_versions, (latest_versions.c.task == Publication.task_id) & (latest_versions.c.revision == Publication.revision))
    return query


def page(db, grant, offset):
    return scoped(db, grant).order_by(Publication.published_at.desc(), Publication.id.desc()).offset(offset).limit(26).all()


def published(db, grant, publication_id, *, current=True, lock=False):
    query = scoped(db, grant, current=current).filter(Publication.id == publication_id)
    return (query.with_for_update(of=Publication).populate_existing() if lock else query).one_or_none()


def acceptance_history(db, company, client, task_ids):
    ranked = db.query(Publication.id.label("publication_id"), func.row_number().over(partition_by=Publication.task_id,
        order_by=Publication.revision.desc()).label("position")).join(TaskClientAcceptance,
        TaskClientAcceptance.publication_id == Publication.id).filter(Publication.company_id == company,
        Publication.client_id == client, Publication.task_id.in_(task_ids)).subquery()
    ids = db.query(ranked.c.publication_id).filter(ranked.c.position <= 10)
    return db.query(Publication.task_id, Publication.revision, TaskClientAcceptance).join(TaskClientAcceptance,
        TaskClientAcceptance.publication_id == Publication.id).filter(Publication.id.in_(ids)).order_by(Publication.revision.desc()).all()


def full_history(db, company, client, task_id, offset):
    return db.query(Publication.revision, TaskClientAcceptance).join(TaskClientAcceptance,
        TaskClientAcceptance.publication_id == Publication.id).filter(Publication.company_id == company,
        Publication.client_id == client, Publication.task_id == task_id).order_by(Publication.revision.desc()).offset(offset).limit(101).all()


def photo(db, publication_id, photo_id):
    return db.query(TaskClientPublicationPhoto).filter_by(publication_id=publication_id, id=photo_id).one_or_none()


def lock_grant(db, user_id, grant_id):
    return db.query(ClientPortalGrant).filter_by(id=grant_id, user_id=user_id).with_for_update(of=ClientPortalGrant).populate_existing().one_or_none()
