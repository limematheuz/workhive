from datetime import datetime,timezone
import csv
from io import StringIO
from fastapi import HTTPException
from app.models.saved_report import SavedReport
from app.repositories import saved_report as repo
from app.schemas.saved_report import ReportInput
from app.services.organization_authorization_service import permitted_location_ids,require_capability
from app.services.user_scope import require_company_context
from app.services.initial_membership_policy import is_initial_worker


LABELS={"id":"ID","title":"Título","name":"Nombre","position":"Cargo","team":"Equipo","location":"Ubicación",
        "status":"Estado","scheduled":"Programado","completed":"Finalizado","checklist_done":"Tareas hechas",
        "checklist_total":"Tareas totales","monthly_hours":"Horas al mes","hourly_cost":"Coste por hora EUR",
        "severity":"Gravedad","created":"Creada","resolved":"Resuelta"}


def scope(db,user,payload):
    company=require_company_context(user)
    if payload.kind=="work" and is_initial_worker(db,user):
        raise HTTPException(403,"Los informes generales de trabajos requieren un perfil de permisos explícito. Consulta tus tareas asignadas en la app del trabajador.")
    if payload.kind=="staff":require_capability(db,user,"labor_costs.read");return company,None
    capability="work.read" if payload.kind=="work" else "quality.incidents.read"
    locations=permitted_location_ids(db,user,capability)
    if payload.location_id is not None and locations is not None and payload.location_id not in locations:
        raise HTTPException(403,"La ubicación queda fuera de tu ámbito.")
    return company,locations


def serialize(row):return dict(id=row.id,name=row.name,**row.configuration)


def read(db,user):
    company=require_company_context(user)
    return [serialize(row) for row in repo.owned(db,company,user.id).order_by(SavedReport.id).limit(100)]


def save(db,user,payload):
    company,_=scope(db,user,payload)
    if repo.owned(db,company,user.id).count()>=100:raise HTTPException(409,"Guarda un máximo de 100 informes. Elimina alguno para añadir otro.")
    row=SavedReport(company_id=company,user_id=user.id,name=payload.name,configuration=payload.model_dump(mode="json",exclude={"name"}))
    db.add(row);db.commit()
    return serialize(row)


def get_owned(db,user,record_id):
    company=require_company_context(user)
    row=repo.owned(db,company,user.id).filter(SavedReport.id==record_id).first()
    if row is None:raise HTTPException(404,"Informe no encontrado")
    return row


def remove(db,user,record_id):
    row=get_owned(db,user,record_id);db.delete(row);db.commit()


def run(db,user,payload,offset=0):
    company,locations=scope(db,user,payload)
    records=repo.data(db,company,payload,locations,offset)
    rows=[]
    for record in records[:500]:
        if payload.kind=="staff":
            values={key:getattr(record,key,None) for key in LABELS}
            values["status"]=(record.profile or {}).get("state","Activo")
        elif payload.kind=="work":
            values=dict(id=record.id,title=record.title,location=record.location.name,status=record.status,
                scheduled=record.scheduled_start_at,completed=record.date_done,
                checklist_done=sum(bool(item.completed) for item in record.checklist_items),checklist_total=len(record.checklist_items))
        else:
            values=dict(id=record.id,title=record.title,location=record.location.name,status=record.status,
                severity=record.severity,created=record.created_at,resolved=record.resolved_at)
        for key,value in values.items():
            if isinstance(value,datetime):values[key]=value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
        rows.append({"__row_id":record.id,**{key:values.get(key) for key in payload.columns}})
    from app.services.company_preferences_service import preferences
    return dict(timezone=preferences(db,company)["timezone"],columns=[dict(key=key,label=LABELS[key]) for key in payload.columns],rows=rows,has_more=len(records)>500)


def export(db,user,record_id,offset):
    record=get_owned(db,user,record_id)
    data=run(db,user,ReportInput(name=record.name,**record.configuration),offset)
    stream=StringIO();writer=csv.writer(stream,delimiter=";")
    writer.writerow([column["label"] for column in data["columns"]])
    for row in data["rows"]:
        values=["" if value is None else str(value) for value in (row[c["key"]] for c in data["columns"])]
        writer.writerow(["'"+value if value.lstrip().startswith(("=","+","-","@")) else value for value in values])
    return stream.getvalue()
