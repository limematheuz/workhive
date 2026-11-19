from app.models.staff_employee import StaffEmployee
from app.models.staff_account import StaffAccount


def people(db,company,ids):
    rows=db.query(StaffEmployee.id,StaffEmployee.name,StaffAccount.user_id).outerjoin(StaffAccount,
        (StaffAccount.employee_id==StaffEmployee.id)&(StaffAccount.company_id==company)).filter(
            StaffEmployee.company_id==company,StaffEmployee.id.in_(ids)).all()
    return {id:(name,user) for id,name,user in rows}


def allocation_progress(db,company,tasks):
    from app.models.workforce_plan import TaskSpaceStaff,StaffChecklistProgress
    return db.query(TaskSpaceStaff,StaffChecklistProgress).outerjoin(StaffChecklistProgress,
        StaffChecklistProgress.allocation_id==TaskSpaceStaff.id).filter(TaskSpaceStaff.company_id==company,TaskSpaceStaff.task_id.in_(tasks)).all()
