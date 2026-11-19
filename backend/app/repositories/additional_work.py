from sqlalchemy.orm import joinedload
from app.models.additional_work import AdditionalWork
from app.models.quote import Quote
from app.models.service_contract import ServiceContract
from app.models.task_item import TaskItem


def query(db, company, locations):
    rows = db.query(AdditionalWork).filter(AdditionalWork.company_id == company)
    return rows if locations is None else rows.filter(AdditionalWork.location_id.in_(locations))


def quote(db, company, quote_id):
    return db.query(Quote).filter_by(company_id=company, id=quote_id, is_active=True).first()


def contract(db, company, quote_id):
    return (db.query(ServiceContract).options(joinedload(ServiceContract.covered_locations))
            .filter_by(company_id=company, source_quote_id=quote_id).first())


def task(db, company, task_id):
    return db.query(TaskItem).filter_by(company_id=company, id=task_id).first()
