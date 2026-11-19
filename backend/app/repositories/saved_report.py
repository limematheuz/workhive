from datetime import datetime,time,timedelta,timezone
from sqlalchemy.orm import joinedload,selectinload
from app.models.saved_report import SavedReport
from app.models.company_preferences import CompanyPreferences
from zoneinfo import ZoneInfo
from app.models.task_item import TaskItem
from app.models.staff_employee import StaffEmployee
from app.models.quality_incident import QualityIncident


def owned(db,company,user):
    return db.query(SavedReport).filter_by(company_id=company,user_id=user)


def data(db,company,payload,locations,offset):
    preferences=db.get(CompanyPreferences,company)
    zone=ZoneInfo(preferences.timezone if preferences else "Europe/Madrid")
    start=datetime.combine(payload.starts_on,time.min,tzinfo=zone).astimezone(timezone.utc)
    end=datetime.combine(payload.ends_on+timedelta(days=1),time.min,tzinfo=zone).astimezone(timezone.utc)
    if payload.kind=="staff":
        query=db.query(StaffEmployee).filter_by(company_id=company)
    elif payload.kind=="work":
        query=db.query(TaskItem).options(joinedload(TaskItem.location),selectinload(TaskItem.checklist_items)).filter(
            TaskItem.company_id==company,TaskItem.scheduled_start_at>=start,TaskItem.scheduled_start_at<end)
    else:
        query=db.query(QualityIncident).options(joinedload(QualityIncident.location)).filter(
            QualityIncident.company_id==company,QualityIncident.created_at>=start,QualityIncident.created_at<end)
    if payload.kind!="staff":
        model=TaskItem if payload.kind=="work" else QualityIncident
        if locations is not None:query=query.filter(model.location_id.in_(locations))
        if payload.location_id is not None:query=query.filter(model.location_id==payload.location_id)
    return query.order_by((StaffEmployee if payload.kind=="staff" else TaskItem if payload.kind=="work" else QualityIncident).id).offset(offset).limit(501).all()
