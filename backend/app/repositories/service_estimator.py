from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from app.models.location import Location
from app.models.client import Client
from app.models.client_opportunity import ClientOpportunity
from app.models.work_session import WorkSession
from app.models.task_item import TaskItem
from app.models.inventory import InventoryMaterial,InventoryWarehouse
from app.models.workforce_plan import QuoteWorkScope
from app.models.quote_revision import QuoteRevision


def locations(db,company,allowed,client_id=None):
    query=db.query(Location).filter(or_(Location.owner_company_id==company,Location.managing_company_id==company))
    if allowed is not None:query=query.filter(Location.id.in_(allowed))
    if client_id is not None:query=query.filter(Location.client_id==client_id)
    return query.order_by(Location.name).all()


def opportunity(db,company,id):
    return db.query(ClientOpportunity).join(Client,Client.id==ClientOpportunity.client_id).filter(
        Client.company_id==company,ClientOpportunity.id==id,ClientOpportunity.is_active.is_(True)).first()


def materials(db,company,ids=None):
    query=db.query(InventoryMaterial).filter_by(company_id=company,is_active=True)
    return query.filter(InventoryMaterial.id.in_(ids)).all() if ids is not None else query.order_by(InventoryMaterial.name).all()


def warehouses(db,company,ids=None):
    query=db.query(InventoryWarehouse).filter_by(company_id=company,is_active=True)
    return query.filter(InventoryWarehouse.id.in_(ids)).all() if ids is not None else query.order_by(InventoryWarehouse.name).all()


def recent_completed(db,company,location,since):
    return db.query(TaskItem).options(selectinload(TaskItem.zones),selectinload(TaskItem.checklist_items)).filter(
        TaskItem.company_id==company,TaskItem.location_id==location,TaskItem.status=="completed",TaskItem.date_done>=since).order_by(TaskItem.date_done.desc()).limit(50).all()


def sessions(db,task_ids):
    return db.query(WorkSession).filter(WorkSession.task_item_id.in_(task_ids),WorkSession.end_time.isnot(None)).all()


def quote_scope(db,company,quote):return db.query(QuoteWorkScope).filter_by(company_id=company,quote_id=quote).first()


def revision(db,id):return db.get(QuoteRevision,id)


def client(db,company,id):return db.query(Client).filter_by(company_id=company,id=id,is_active=True).first()
