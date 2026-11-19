"""Operational search reuses the same tenant and assignment predicates as its lists."""
from sqlalchemy import String, and_, cast, or_
from app.models.location import Location
from app.models.quality_incident import QualityIncident
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.models.task_report import TaskReport
from app.models.work_session import WorkSession
from app.repositories.task_assignment_scope import assigned_task_condition
from app.repositories.work_session_scope import company_scope
from app.repositories.workspace_search_text import Hit, context, window


def tasks(db, access, term, limit):
    query = db.query(TaskItem.id, TaskItem.title, TaskItem.status, TaskItem.scheduled_start_at,
        Location.name, Location.address).join(Location, Location.id == TaskItem.location_id).filter(or_(
            and_(TaskItem.status != "rejected", TaskItem.company_id == access.company_id),
            and_(TaskItem.status == "rejected", TaskItem.checkout_reservation_id.is_(None), TaskItem.company_id == access.company_id),
            TaskItem.checkout_reservation.has(Reservation.owner_company_id == access.company_id)))
    if access.task_locations is not None:
        query = query.filter(TaskItem.location_id.in_(access.task_locations))
    if access.task_requested_locations is not None:
        query = query.filter(or_(TaskItem.status != "requested", TaskItem.location_id.in_(access.task_requested_locations)))
    else:
        query = query.filter(or_(TaskItem.status != "requested", TaskItem.company_id == access.company_id))
    if access.task_own_user is not None:
        query = query.filter(assigned_task_condition(access.task_own_user), TaskItem.status.in_(access.task_viewer_statuses))
    rows = window(query, term, [TaskItem.title, Location.name, Location.address], identifier=TaskItem.id,
        title=TaskItem.title, date=TaskItem.scheduled_start_at, limit=limit)
    return [Hit(row.id, row.title, context(row.name, row.address), row.status, f"#{row.id}", row.scheduled_start_at) for row in rows]


def reports(db, access, term, limit):
    query = db.query(TaskReport.id, TaskReport.title, TaskReport.report_type, TaskReport.created_at,
        TaskItem.title.label("task_title"), Location.name).join(TaskItem, TaskItem.id == TaskReport.task_item_id).join(
        Location, Location.id == TaskItem.location_id).filter(or_(
            TaskReport.reporter_company_id == access.company_id, TaskReport.requesting_company_id == access.company_id))
    if access.task_locations is not None:
        query = query.filter(TaskItem.location_id.in_(access.task_locations))
    if access.report_assigned_user is not None:
        query = query.filter(assigned_task_condition(access.report_assigned_user))
    rows = window(query, term, [TaskReport.title, TaskReport.description, TaskItem.title, Location.name],
        identifier=TaskReport.id, title=TaskReport.title, date=TaskReport.created_at, limit=limit)
    labels = {"issue":"Incidencia", "note":"Nota", "photo":"Fotografía", "checklist_note":"Nota de tarea", "checklist_photo":"Foto de tarea"}
    return [Hit(row.id, row.title or labels.get(row.report_type, "Parte"), context(row.task_title, row.name),
        None, f"#{row.id}", row.created_at) for row in rows]


def time(db, access, term, limit):
    query = db.query(WorkSession.id, WorkSession.start_time, WorkSession.end_time, WorkSession.paused_at,
        Location.name, TaskItem.title).outerjoin(Location, Location.id == WorkSession.location_id).outerjoin(
        TaskItem, TaskItem.id == WorkSession.task_item_id).filter(
            WorkSession.user_id == access.user_id, company_scope(access.company_id))
    if access.time_locations is not None:
        query = query.filter(WorkSession.location_id.in_(access.time_locations))
    rows = window(query, term, [WorkSession.notes, Location.name, TaskItem.title, cast(WorkSession.start_time, String)],
        identifier=WorkSession.id, title=WorkSession.notes, date=WorkSession.start_time, limit=limit)
    return [Hit(row.id, "Fichaje · " + row.start_time.date().isoformat(), context(row.name, row.title),
        "closed" if row.end_time else "paused" if row.paused_at else "active", f"#{row.id}", row.start_time) for row in rows]


def incidents(db, access, term, limit):
    query = db.query(QualityIncident.id, QualityIncident.title, QualityIncident.status, QualityIncident.created_at,
        Location.name).join(Location, Location.id == QualityIncident.location_id).filter(
            QualityIncident.company_id == access.company_id)
    if access.incident_locations is not None:
        query = query.filter(QualityIncident.location_id.in_(access.incident_locations))
    rows = window(query, term, [QualityIncident.title, QualityIncident.description, Location.name],
        identifier=QualityIncident.id, title=QualityIncident.title, date=QualityIncident.created_at, limit=limit)
    return [Hit(row.id, row.title, context(row.name), row.status, f"#{row.id}", row.created_at) for row in rows]
