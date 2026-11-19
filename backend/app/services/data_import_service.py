from hashlib import sha256
import json
from decimal import Decimal
from fastapi import HTTPException
from pydantic import ValidationError
from app.models.import_batch import ImportBatch
from app.schemas.staff import EmployeeInput
from app.schemas.client import ClientCreate
from app.services import staff_service,client_service,location_service,quick_work_service,operational_import_policy
from app.services.organization_authorization_service import require_capability,permitted_location_ids
from app.services.user_scope import require_company_context


def normalize(db,user,kind,records):
    company=require_company_context(user)
    permissions={"staff":"labor_costs.manage","clients":"clients.manage","locations":"locations.manage","work":"work.manage"}
    if kind not in permissions:raise HTTPException(422,"Tipo de importación no admitido.")
    if kind=="work":permitted_location_ids(db,user,"work.manage")
    else:require_capability(db,user,permissions[kind])
    parsed=[]
    for index,record in enumerate(records,2):
        try:
            if kind=="staff":
                values=dict(record)
                values.setdefault("monthly_hours","160");values.setdefault("hourly_cost","0");values.setdefault("team","")
                values["monthly_hours"]=str(values["monthly_hours"]).replace(",",".")
                values["hourly_cost"]=str(values["hourly_cost"]).replace(",",".")
                values.setdefault("profile",{"other":str(Decimal(values["monthly_hours"])*Decimal(values["hourly_cost"]))})
                parsed.append(EmployeeInput.model_validate(values))
            elif kind in {"locations","work"}:
                value=operational_import_policy.normalize(db,user,kind,record)
                if kind=="work":
                    if value.location_id is None:require_capability(db,user,"work.manage",scope_type="company")
                    else:
                        from app.services import location_access_service
                        location_access_service.require_location_capability(db,user,value.location_id,"can_manage_tasks",permission_code="work.manage")
                parsed.append(value)
            else:
                parsed.append(ClientCreate.model_validate({**record,"company_id":company}))
        except (ValidationError,ValueError) as exc:
            if isinstance(exc,ValidationError):
                problems=exc.errors(include_input=False,include_url=False)
                description="; ".join(".".join(map(str,error["loc"]))+": "+error["msg"] for error in problems[:4])
            else:description=str(exc)
            raise HTTPException(422,f"Revisa la fila {index}. {description}") from exc
    return parsed


def preview(db,user,kind,records):
    return [row.model_dump(mode="json") for row in normalize(db,user,kind,records)]


def execute(db,user,kind,records):
    company=require_company_context(user)
    parsed=normalize(db,user,kind,records)
    normalized=[p.model_dump(mode="json") for p in parsed]
    digest=sha256(json.dumps([kind,normalized],sort_keys=True).encode()).hexdigest()
    from app.repositories.data_import import existing_batch,lock_company
    lock_company(db,company)
    existing=existing_batch(db,company,digest)
    if existing:return {"ids":existing.result_ids,"already_imported":True}
    batch=ImportBatch(company_id=company,digest=digest,kind=kind,created_by=user.id)
    try:
        db.add(batch);db.flush()
        items=[]
        for payload in parsed:
            if kind=="staff":item=staff_service.create_staff(payload,db,user,commit=False)
            elif kind=="clients":item=client_service.create_client(db,payload,commit=False)
            elif kind=="locations":item=location_service.create_location_in_transaction(db,company,payload)
            else:item=quick_work_service.create(db,user,payload,commit=False)
            items.append(item)
        batch.result_ids=[item["task_id"] if isinstance(item,dict) else item.id for item in items]
        db.commit()
    except Exception:
        db.rollback()
        raise
    if kind=="work":
        from app.repositories import workforce_plan
        from app.services import task_item_service
        for id in batch.result_ids:task_item_service.publish_created_task(db,workforce_plan.task_record(db,company,id))
    return {"ids":batch.result_ids,"already_imported":False}
