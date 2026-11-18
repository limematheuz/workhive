from app.models.task_item import TaskItem


def has_open_work(db,company,order):
    return db.query(TaskItem.id).filter(TaskItem.company_id==company,TaskItem.work_order_id==order,
        TaskItem.status.notin_(["completed","cancelled"]),TaskItem.is_invoiced.is_(False)).first() is not None
