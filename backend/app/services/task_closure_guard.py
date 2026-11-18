"""Storage backstop for completion paths; callbacks import policies lazily."""
from sqlalchemy import event
from sqlalchemy.orm import Session


def before_flush(session,context,instances):
    from app.models.task_item import TaskItem
    from app.models.work_session import WorkSession
    from app.models.work_session_pause import WorkSessionPause
    from app.repositories.workflow_approval import affected_completed_tasks
    from app.services.workflow_approval_policy import enforce_current_approval
    tasks={};session_ids=set();pause_sessions=set();task_ids=set()
    for row in tuple(session.dirty)+tuple(session.new)+tuple(session.deleted):
        if isinstance(row,TaskItem) and row.id is not None and row.status=="completed":tasks[row.id]=row
        elif isinstance(row,WorkSession) and row.task_item_id is not None:
            task_ids.add(row.task_item_id)
            if row.id is not None:session_ids.add(row.id)
        elif isinstance(row,WorkSessionPause) and row.work_session_id is not None:pause_sessions.add(row.work_session_id)
    for row in affected_completed_tasks(session,task_ids,session_ids,pause_sessions):tasks[row.id]=row
    for row in tasks.values():enforce_current_approval(session,row)


def install():
    if not event.contains(Session,"before_flush",before_flush):event.listen(Session,"before_flush",before_flush)
