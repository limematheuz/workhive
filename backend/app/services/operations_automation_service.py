from datetime import datetime,timezone,timedelta
from fastapi import HTTPException
from app.models.operations_automation import OperationsAutomation
from app.repositories import operations_automation as repo
from app.services import notification_service,work_order_service
from app.services.organization_authorization_service import require_capability,has_capability
from app.services.user_scope import require_company_context


def utc(value):
    return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)


def serialize(row):
    return {key:getattr(row,key) for key in ("recurring","documents","incidents","horizon_days","last_run","last_result")}


def read(db,user):
    company=require_company_context(user)
    require_capability(db,user,"access.members.manage")
    row=repo.settings(db,company)
    return serialize(row) if row else dict(recurring=False,documents=False,incidents=False,horizon_days=7,last_run=None,last_result=None)


def save(db,user,payload):
    company=require_company_context(user)
    require_capability(db,user,"access.members.manage")
    row=repo.settings(db,company)
    if row is None:
        row=OperationsAutomation(company_id=company);db.add(row)
    for key,value in payload.model_dump().items():setattr(row,key,value)
    db.commit()
    return serialize(row)


def run_company(db,settings):
    company=settings.company_id
    now=datetime.now(timezone.utc)
    created=0
    issues=[]
    if settings.recurring:
        for order in repo.orders(db,company,now+timedelta(days=settings.horizon_days)):
            creator=repo.user(db,order.created_by_user_id)
            if not creator or not creator.is_active or creator.company_id!=company:
                issues.append(f"Orden {order.id} pendiente de responsable activo.")
                continue
            try:
                work_order_service.generate_next_task(db,creator,order.id)
                created+=1
            except HTTPException as exc:
                db.rollback()
                issues.append(f"Orden {order.id} · {exc.detail}")
    users=repo.recipients(db,company)
    if settings.documents:
        recipients=[u for u in users if has_capability(db,u,"labor_costs.read")]
        from app.services.staff_documentation_service import digest
        for employee in repo.staff(db,company):
            for document in (employee.profile or {}).get("documents",[]):
                expiry=document.get("expires_on")
                if not expiry or expiry>(now.date()+timedelta(days=30)).isoformat():continue
                stage="caducado" if expiry<now.date().isoformat() else "próximo a caducar"
                notification_service.notify_users_once(db,users=recipients,event_type="staff.document_due",
                    title="Documentación de personal",message=f"{employee.name} · {document['name']} · {stage}",
                    entity_type="staff_employee",entity_id=employee.id,href="/dashboard/plantilla/documentacion",
                    dedupe_key=f"{digest(document)}:{stage}",commit=False)
    if settings.incidents:
        for incident,contract in repo.incident_contracts(db,company):
            targets=[("resolution",contract.resolution_time_hours)]
            if incident.status=="open":targets.append(("response",contract.response_time_hours))
            recipients=[u for u in users if has_capability(db,u,"quality.incidents.read",scope_type="location",scope_id=incident.location_id)]
            for target,hours in targets:
                if hours is None or utc(incident.created_at)+timedelta(hours=hours)>now:continue
                notification_service.notify_users_once(db,users=recipients,event_type="quality.sla_overdue",
                    title="Incidencia fuera de plazo",message=("Respuesta" if target=="response" else "Resolución")+" · "+incident.title,
                    entity_type="quality_incident",entity_id=incident.id,href="/dashboard/quality",
                    dedupe_key=f"contract:{contract.id}:{target}:{hours}",commit=False)
    settings.last_run=now
    settings.last_result=(f"{created} ejecuciones generadas. "+" ".join(issues))[:2000]
    db.commit()
    return serialize(settings)


def run(db,user):
    company=require_company_context(user)
    require_capability(db,user,"access.members.manage")
    settings=repo.settings(db,company)
    if settings is None:raise HTTPException(409,"Guarda primero la configuración.")
    return run_company(db,settings)
