from sqlalchemy import func
from app.models.task_item import TaskItem
from app.models.work_session import WorkSession
from app.models.staff_shift import StaffShift
from app.models.invoice import Invoice
from app.models.customer_payment import CustomerPayment
from app.models.quality_incident import QualityIncident
from app.models.client_opportunity import ClientOpportunity
from app.models.client import Client
from app.models.inventory import InventoryMovement


def scoped(query,model,allowed):return query if allowed is None else query.filter(model.location_id.in_(allowed))


def tasks(db,company,start,end,allowed):
    query=scoped(db.query(TaskItem).filter(TaskItem.company_id==company,TaskItem.scheduled_start_at>=start,TaskItem.scheduled_start_at<end),TaskItem,allowed)
    return query.yield_per(500)


def unbilled_count(db,company,allowed):
    return scoped(db.query(TaskItem).filter(TaskItem.company_id==company,TaskItem.status=="completed",TaskItem.is_invoiced.is_(False)),TaskItem,allowed).count()


def shifts(db,company,start,end,allowed):
    return scoped(db.query(StaffShift).filter(StaffShift.company_id==company,StaffShift.starts_at<end,StaffShift.ends_at>start),StaffShift,allowed).yield_per(500)


def sessions(db,company,start,end,allowed):
    query=db.query(WorkSession).join(TaskItem,TaskItem.id==WorkSession.task_item_id).filter(TaskItem.company_id==company,WorkSession.end_time>=start,WorkSession.end_time<end)
    if allowed is not None:query=query.filter(TaskItem.location_id.in_(allowed))
    return query.yield_per(500)


def received(db,company,start,end):
    return db.query(func.coalesce(func.sum(CustomerPayment.amount),0)).filter(CustomerPayment.company_id==company,
        CustomerPayment.status=="received",CustomerPayment.received_at>=start,CustomerPayment.received_at<end).scalar()


def open_invoices(db,company):
    return db.query(Invoice).filter(Invoice.company_id==company,Invoice.is_active.is_(True),Invoice.status.in_(["issued","partially_paid","overdue"]),Invoice.is_rectification.is_(False)).all()


def open_incidents(db,company,allowed):
    return scoped(db.query(QualityIncident).filter(QualityIncident.company_id==company,QualityIncident.status.in_(["open","in_progress"])),QualityIncident,allowed).count()


def pipeline(db,company):
    return db.query(ClientOpportunity.stage,func.count(ClientOpportunity.id)).join(Client,Client.id==ClientOpportunity.client_id).filter(Client.company_id==company,ClientOpportunity.is_active.is_(True)).group_by(ClientOpportunity.stage).all()


def unknown_materials(db,company,start,end):
    reversal=db.query(InventoryMovement.reversal_of_movement_id).filter(InventoryMovement.company_id==company,InventoryMovement.reversal_of_movement_id.isnot(None))
    return db.query(InventoryMovement).filter(InventoryMovement.company_id==company,InventoryMovement.movement_type=="issue",InventoryMovement.unit_cost.is_(None),InventoryMovement.created_at>=start,InventoryMovement.created_at<end,InventoryMovement.id.notin_(reversal)).count()


def completed_without_hours(db,company,start,end,allowed):
    from sqlalchemy import exists
    query=db.query(TaskItem).filter(TaskItem.company_id==company,TaskItem.status=="completed",TaskItem.date_done>=start,TaskItem.date_done<end,
        ~exists().where(WorkSession.task_item_id==TaskItem.id,WorkSession.end_time.isnot(None)))
    return scoped(query,TaskItem,allowed).count()


def staff_without_hours(db,company,start,end,allowed):
    from sqlalchemy import exists,select
    from app.models.workforce_plan import TaskSpaceStaff
    from app.models.staff_account import StaffAccount
    closed=select(WorkSession.id).join(StaffAccount,StaffAccount.user_id==WorkSession.user_id).where(
        StaffAccount.company_id==company,StaffAccount.employee_id==TaskSpaceStaff.employee_id,
        WorkSession.task_item_id==TaskSpaceStaff.task_id,WorkSession.end_time.isnot(None)).exists()
    query=db.query(TaskSpaceStaff.task_id,TaskSpaceStaff.employee_id).join(TaskItem,TaskItem.id==TaskSpaceStaff.task_id).filter(
        TaskSpaceStaff.company_id==company,TaskItem.company_id==company,TaskItem.status=="completed",TaskItem.date_done>=start,TaskItem.date_done<end,~closed)
    if allowed is not None:query=query.filter(TaskItem.location_id.in_(allowed))
    return query.distinct().count()
