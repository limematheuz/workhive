"""One-off jobs share canonical task, location, staff and billing records."""
from datetime import timedelta
from fastapi import HTTPException
from app.models.audit_log import AuditLog
from app.schemas.location import LocationCreate
from app.schemas.location_workspace import LocationProfileInput
from app.schemas.task_item import TaskItemCreate
from app.repositories import workforce_plan as repo
from app.services import location_access_service,location_service,template_task_service,task_item_service,general_workforce_service
from app.services.organization_authorization_service import require_capability,permitted_location_ids,has_capability
from app.services.user_scope import require_company_context
from app.services.entitlement_service import company_feature_enabled

def choices(db,user,location_id=None):
    company=require_company_context(user)
    scopes=permitted_location_ids(db,user,"work.manage")
    can_address=has_capability(db,user,"work.manage",scope_type="company")
    if location_id is not None:
        location_access_service.require_location_capability(db,user,location_id,"can_manage_tasks",permission_code="work.manage")
    elif scopes is not None:
        return dict(people=[],crews=[],can_create_address=False)
    hr=company_feature_enabled(db,company_id=company,code="features.hr")
    return dict(people=[dict(id=p.id,name=p.name,position=p.position) for p in repo.people(db,company) if (p.profile or {}).get("state")!="Baja"] if hr else [],crews=[dict(id=c.id,name=c.name) for c in repo.crews(db,company) if c.is_active] if hr else [],can_create_address=can_address)

def create(db,user,payload,*,commit=True):
    company=require_company_context(user)
    try:
        if payload.location_id is not None:
            location=location_access_service.require_location_capability(db,user,payload.location_id,"can_manage_tasks",permission_code="work.manage")
            # Access services may return a policy object; use the canonical location projection.
            location=location_service.get_location(db,payload.location_id,company)
            if payload.client_id is not None and location.client_id!=payload.client_id:raise HTTPException(422,"El cliente no coincide con el centro seleccionado.")
        else:
            require_capability(db,user,"work.manage",scope_type="company")
            if payload.save_location:require_capability(db,user,"locations.manage",scope_type="company")
            location=location_service.create_location_in_transaction(db,company,LocationCreate(name=payload.title[:100],address=payload.address,city=payload.city,postal_code=payload.postal_code,client_id=payload.client_id,location_type="other",profile=LocationProfileInput(site_type="other")))
            location.is_temporary=not payload.save_location;db.flush()
        service=template_task_service.get_template_task(db,payload.service_id,company) if payload.service_id else None
        if service is not None and not service.is_active:raise HTTPException(409,"El servicio está archivado.")
        description="\n".join("- [ ] "+text for text in payload.tasks) if payload.tasks is not None else service.description if service else None
        price=float(payload.price) if payload.price is not None else service.default_price if service else None
        task=task_item_service.create_task_item(db,user,TaskItemCreate(title=payload.title,location_id=location.id,template_task_id=service.id if service else None,description=description,notes=payload.instructions or None,unit=service.unit if service else "service",pricing_mode=service.pricing_mode if service else "fixed",price=price,quantity=1,scheduled_start_at=payload.scheduled_start_at,due_at=payload.scheduled_start_at+timedelta(minutes=payload.duration_minutes)),commit=False)
        general_workforce_service.apply(db,user,task,payload.employee_ids,payload.crew_id,payload.duration_minutes)
        db.add(AuditLog(company_id=company,actor_user_id=user.id,action="work.quick_created",entity_type="task_item",entity_id=str(task.id),details={"location_id":location.id,"temporary_address":bool(location.is_temporary),"employee_ids":payload.employee_ids,"crew_id":payload.crew_id,"service_id":payload.service_id}))
        if commit:db.commit();task_item_service.publish_created_task(db,task)
        else:db.flush()
        return dict(task_id=task.id,location_id=location.id,temporary_address=bool(location.is_temporary))
    except Exception:db.rollback();raise


def locations(db,user,query):
    from app.repositories import location as location_repo
    company=require_company_context(user);ids=permitted_location_ids(db,user,"work.manage")
    return [dict(id=row.id,name=row.name,address=row.address,city=row.city,client_id=row.client_id) for row in location_repo.search_work_locations(db,company,query,ids)]
