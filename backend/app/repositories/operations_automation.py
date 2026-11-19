from sqlalchemy import or_
from app.models.operations_automation import OperationsAutomation
from app.models.work_order import WorkOrder
from app.models.user import User
from app.models.quality_incident import QualityIncident
from app.models.service_contract import ServiceContractLocation,ServiceContract
from app.models.staff_employee import StaffEmployee


def settings(db,company):
    return db.get(OperationsAutomation,company)


def configured(db):
    return db.query(OperationsAutomation).filter((OperationsAutomation.recurring.is_(True))|
            (OperationsAutomation.documents.is_(True))|(OperationsAutomation.incidents.is_(True))).all()


def orders(db,company,horizon):
    return db.query(WorkOrder).filter(WorkOrder.company_id==company,WorkOrder.order_type=="recurring",
        WorkOrder.status=="active",WorkOrder.next_occurrence_at<=horizon).order_by(WorkOrder.next_occurrence_at).limit(100).all()


def user(db,user_id):
    return db.get(User,user_id)


def recipients(db,company):
    return db.query(User).filter_by(company_id=company,is_active=True).all()


def staff(db,company):
    return db.query(StaffEmployee).filter_by(company_id=company).all()


def incident_contracts(db,company):
    return (db.query(QualityIncident,ServiceContract).join(ServiceContractLocation,ServiceContractLocation.location_id==QualityIncident.location_id)
        .join(ServiceContract,ServiceContract.id==ServiceContractLocation.contract_id)
        .filter(QualityIncident.company_id==company,QualityIncident.resolved_at.is_(None),
                ServiceContract.company_id==company,ServiceContract.status=="active",ServiceContractLocation.is_active.is_(True),
                or_(ServiceContract.starts_at.is_(None),ServiceContract.starts_at<=QualityIncident.created_at),
                or_(ServiceContract.ends_at.is_(None),ServiceContract.ends_at>=QualityIncident.created_at)).all())
