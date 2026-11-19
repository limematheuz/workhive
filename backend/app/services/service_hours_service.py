from app.models.audit_log import AuditLog
from datetime import datetime, timezone
from hashlib import sha256
from fastapi import HTTPException
from app.models.task_item import TaskItem
from app.models.service_hours_review import ServiceHoursReview
from app.repositories import service_hours as repo
from app.services.labor_cost_snapshot_service import _worked_seconds
from app.services.organization_authorization_service import permitted_location_ids
from app.services.user_scope import require_company_context

def scoped_tasks(db, user, permission):
    company_id = require_company_context(user)
    locations = permitted_location_ids(db, user, permission)
    return repo.tasks(db, company_id, locations)


def session_summary(sessions):
    ordered = sorted(sessions, key=lambda session: session.id)
    fingerprint = repr([(s.id, s.user_id, s.start_time, s.end_time, s.paused_seconds) for s in ordered])
    return sum(_worked_seconds(s) for s in ordered), sha256(fingerprint.encode()).hexdigest()


def read_hours(db, current_user, offset=0):
    tasks = scoped_tasks(db,current_user,"time.read").filter(TaskItem.status != "cancelled").order_by(TaskItem.id.desc()).offset(max(0,offset)).limit(101).all()
    ids = [t.id for t in tasks[:100]]
    sessions = {}
    for session in repo.sessions(db, ids):
        sessions.setdefault(session.task_item_id, []).append(session)
    reviews = {r.task_id:r for r in repo.reviews(db, ids)}
    orders = {o.id:o for o in repo.orders(db, require_company_context(current_user), [t.work_order_id for t in tasks if t.work_order_id])}
    shift_minutes = repo.planned_minutes(db,require_company_context(current_user),ids)
    rows = []
    for task in tasks[:100]:
        review = reviews.get(task.id)
        logs = sessions.get(task.id, [])
        seconds,signature = session_summary(logs)
        order = orders.get(task.work_order_id)
        planned = order.estimated_people * order.estimated_minutes if order and order.estimated_people and order.estimated_minutes else None
        planned = shift_minutes.get(task.id,planned)
        rows.append(dict(id=task.id,title=task.title,planned_minutes=planned,
                         contract_minutes=review.contract_minutes if review else None,
                         worked_seconds=seconds,approved_seconds=review.approved_seconds if review and review.session_signature==signature else None,
                         can_close=bool(logs) and all(s.end_time for s in logs),signature=signature))
    return dict(items=rows,has_more=len(tasks)>100)


def record(db,user,task_id,permission):
    task = scoped_tasks(db,user,permission).filter(TaskItem.id==task_id).with_for_update().first()
    if task is None:
        raise HTTPException(404,"Trabajo no encontrado")
    review = db.get(ServiceHoursReview, task_id)
    if review is None:
        review = ServiceHoursReview(task_id=task_id)
        db.add(review)
    return review


def set_contract(db, current_user, task_id, payload):
    review = record(db,current_user,task_id,"work.manage")
    review.contract_minutes = payload.minutes
    db.add(AuditLog(company_id=current_user.company_id,actor_user_id=current_user.id,action="service.contract_hours",entity_type="task_item",entity_id=str(task_id),details={"minutes":payload.minutes}))
    db.commit()
    return {"ok":True}


def approve(db, current_user, task_id, payload):
    review = record(db,current_user,task_id,"time.approve")
    sessions = repo.sessions(db, [task_id])
    seconds,signature = session_summary(sessions)
    if not sessions or any(s.end_time is None for s in sessions) or signature!=payload.signature:
        raise HTTPException(409,"Revisa los fichajes actualizados antes de aprobar.")
    review.approved_seconds,review.session_signature = seconds,signature
    review.approved_by,review.approved_at = current_user.id,datetime.now(timezone.utc)
    db.add(AuditLog(company_id=current_user.company_id,actor_user_id=current_user.id,action="service.hours_approved",entity_type="task_item",entity_id=str(task_id),details={"seconds":seconds}))
    db.commit()
    return {"ok":True}

def approved_export(db, current_user, month):
    allowed_tasks = scoped_tasks(db, current_user, "time.read")
    payroll_locations = permitted_location_ids(db, current_user, "labor_costs.read")
    if payroll_locations is not None:
        allowed_tasks = allowed_tasks.filter(TaskItem.location_id.in_(payroll_locations))
    return export_for_tasks(db, allowed_tasks, month)


def export_for_tasks(db, allowed_tasks, month):
    """Export signed-off sessions in the UTC month of their end time."""
    import csv
    from io import StringIO
    from fastapi.responses import Response

    try:
        start = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc)
        end = start.replace(year=start.year + (start.month == 12), month=start.month % 12 + 1)
    except (ValueError, OverflowError):
        raise HTTPException(422, "Selecciona un mes válido.")

    sessions = repo.approved_entries(db, allowed_tasks, start, end)
    from itertools import groupby
    output = StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["ID de fichaje", "Persona que fichó", "ID de tarea", "Trabajo",
                     "Fin del fichaje (UTC)", "Segundos aprobados"])
    for _, grouped in groupby(sessions, key=lambda entry: entry[0].task_item_id):
        entries = list(grouped)
        signature = session_summary([entry[0] for entry in entries])[1]
        if entries[0][1].session_signature != signature:
            continue
        for log, review, title in entries:
            ended = log.end_time
            if ended is None:
                continue
            ended = ended.astimezone(timezone.utc) if ended.tzinfo else ended.replace(tzinfo=timezone.utc)
            if start <= ended < end:
                writer.writerow([log.id, safe_csv_label(log.user.full_name or str(log.user_id)),
                                 review.task_id, safe_csv_label(title), ended.isoformat(), _worked_seconds(log)])
    return Response(content=output.getvalue().encode("utf-8-sig"), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="horas-aprobadas-{start:%Y-%m}.csv"'})


def safe_csv_label(value: str) -> str:
    return "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) or value.startswith(("\t", "\r", "\n")) else value
