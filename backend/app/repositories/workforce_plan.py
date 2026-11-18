from sqlalchemy.orm import joinedload
from app.models.workforce_plan import WorkCrew,WorkCrewMember,WorkOrderScope,TaskSpaceStaff,StaffChecklistProgress,QuoteWorkScope
from app.models.staff_employee import StaffEmployee
from app.models.staff_account import StaffAccount
from app.models.location_zone import LocationZone,LocationSpaceTaskTemplate
from app.models.task_structure import TaskChecklistItem


def crews(db,company):return db.query(WorkCrew).filter_by(company_id=company).order_by(WorkCrew.name)


def members(db,crew_ids):
    return db.query(WorkCrewMember).filter(WorkCrewMember.crew_id.in_(crew_ids)).all()


def people(db,company,ids=None):
    query=db.query(StaffEmployee).filter_by(company_id=company)
    return query.filter(StaffEmployee.id.in_(ids)) if ids is not None else query


def crew(db,company,crew_id):return crews(db,company).filter(WorkCrew.id==crew_id).with_for_update().first()


def spaces(db,location):return db.query(LocationZone).filter_by(location_id=location,is_active=True).order_by(LocationZone.sort_order,LocationZone.id).all()


def templates(db,ids):return db.query(LocationSpaceTaskTemplate).filter(LocationSpaceTaskTemplate.id.in_(ids),LocationSpaceTaskTemplate.is_active.is_(True)).all()


def accounts(db,company,employee_ids):
    return db.query(StaffAccount).filter(StaffAccount.company_id==company,StaffAccount.employee_id.in_(employee_ids)).all()


def scope(db,company,order):return db.query(WorkOrderScope).filter_by(company_id=company,work_order_id=order).first()


def allocations(db,company,task_ids):return db.query(TaskSpaceStaff).filter(TaskSpaceStaff.company_id==company,TaskSpaceStaff.task_id.in_(task_ids))


def progress(db,allocation_ids):return db.query(StaffChecklistProgress).filter(StaffChecklistProgress.allocation_id.in_(allocation_ids)).all()


def checklist(db,ids):return db.query(TaskChecklistItem).filter(TaskChecklistItem.id.in_(ids)).all()


def own_employee(db,company,user):
    return db.query(StaffAccount.employee_id).filter_by(company_id=company,user_id=user).scalar()


def task_progress(db,company,task):
    return db.query(StaffChecklistProgress,TaskSpaceStaff).join(TaskSpaceStaff,TaskSpaceStaff.id==StaffChecklistProgress.allocation_id).filter(TaskSpaceStaff.company_id==company,TaskSpaceStaff.task_id==task)


def task_record(db,company,task_id):
    from app.models.task_item import TaskItem
    return db.query(TaskItem).filter_by(company_id=company,id=task_id).with_for_update().first()


def order(db,company,id):
    from app.models.work_order import WorkOrder
    return db.query(WorkOrder).filter_by(company_id=company,id=id).first()


def contract_record(db,company,id):
    from app.models.service_contract import ServiceContract
    return db.query(ServiceContract).filter_by(company_id=company,id=id).with_for_update().first()


def contract_execution_count(db,company,contract):
    from app.models.work_order import WorkOrder
    from app.models.task_item import TaskItem
    return db.query(TaskItem).join(WorkOrder,WorkOrder.id==TaskItem.work_order_id).filter(WorkOrder.company_id==company,WorkOrder.service_contract_id==contract).count()
