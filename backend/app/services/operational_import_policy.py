"""Resolve spreadsheet labels to company-owned canonical records before writing."""
from datetime import datetime,timezone
from app.repositories import import_reference as repo,client as client_repo
from app.schemas.location import LocationCreate
from app.schemas.quick_work import QuickWorkInput
from app.services.staff_shift_service import company_zone

def reference(db,company,kind,value):
    rows=repo.named(db,company,kind,str(value))
    if len(rows)!=1:raise ValueError(f"No hay un registro único de {kind} con el nombre indicado. Utiliza su identificador.")
    return rows[0].id

def normalize(db,user,kind,record):
    company=user.company_id;data={key:value for key,value in record.items() if value not in (None,"")}
    if data.get("client_name"):data["client_id"]=reference(db,company,"client",data.pop("client_name"))
    if kind=="locations":
        if data.get("client_id") and client_repo.get_client_by_id(db,int(data["client_id"]),company) is None:raise ValueError("El cliente no pertenece a la empresa activa.")
        return LocationCreate.model_validate(data)
    for label,target,entity in [("location_name","location_id","location"),("service_name","service_id","service"),("crew_name","crew_id","crew")]:
        if data.get(label):data[target]=reference(db,company,entity,data.pop(label))
    if data.get("employee_name"):data["employee_ids"]=[reference(db,company,"employee",name.strip()) for name in data.pop("employee_name").split("|") if name.strip()]
    if isinstance(data.get("employee_ids"),str):data["employee_ids"]=[int(value.strip()) for value in data["employee_ids"].split("|") if value.strip()]
    if isinstance(data.get("tasks"),str):data["tasks"]=[value.strip() for value in data["tasks"].split("|") if value.strip()]
    if data.get("scheduled_start_at"):
        at=datetime.fromisoformat(str(data["scheduled_start_at"]))
        if at.tzinfo is None:
            zone=company_zone(db,company);aware=at.replace(tzinfo=zone,fold=0);other=at.replace(tzinfo=zone,fold=1)
            if aware.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None)!=at or aware.utcoffset()!=other.utcoffset():raise ValueError("La hora coincide con un cambio horario. Indica el desfase UTC explícito.")
            at=aware
        data["scheduled_start_at"]=at
    data.setdefault("duration_minutes",60)
    return QuickWorkInput.model_validate(data)
