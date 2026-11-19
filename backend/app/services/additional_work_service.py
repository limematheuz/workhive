from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from app.models.additional_work import AdditionalWork
from app.models.work_order import WorkOrder
from app.repositories import additional_work as repo
from app.schemas.task_item import TaskItemCreate
from app.services import location_access_service, task_item_service, work_order_service
from app.services.organization_authorization_service import permitted_location_ids, require_capability
from app.services.user_scope import require_company_context


def scoped(db, user, permission):
    return repo.query(db, require_company_context(user), permitted_location_ids(db, user, permission))


def serialize(db, user, item):
    quote = repo.quote(db, item.company_id, item.quote_id) if item.quote_id else None
    task = repo.task(db, item.company_id, item.task_id) if item.task_id else None
    contract = repo.contract(db, item.company_id, item.quote_id) if quote else None
    stage = "Petición"
    if quote:
        stage = "Aceptado" if quote.status == "accepted" else "Presupuesto " + quote.status
    if task:
        stage = "Facturado" if task.is_invoiced else "Pendiente de facturar" if task.status == "completed" else "En ejecución"
    return dict(id=item.id, title=item.title, description=item.description, location_id=item.location_id,
                quote_id=item.quote_id, task_id=item.task_id, contract_id=contract.id if contract else None, stage=stage)


def list_requests(db, user):
    require_capability(db, user, "finance.read")
    return [serialize(db, user, item) for item in scoped(db, user, "work.read").order_by(AdditionalWork.id.desc()).all()]


def create(db, user, payload):
    require_capability(db, user, "finance.manage")
    location_access_service.require_location_capability(db, user, payload.location_id, "can_manage_tasks", permission_code="work.manage")
    item = AdditionalWork(company_id=require_company_context(user), created_by=user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    return serialize(db, user, item)


def editable(db, user, item_id):
    require_capability(db, user, "finance.manage")
    item = scoped(db, user, "work.manage").filter(AdditionalWork.id == item_id).with_for_update().first()
    if item is None:
        raise HTTPException(404, "Petición no encontrada")
    return item


def link_quote(db, user, item_id, payload):
    item = editable(db, user, item_id)
    if item.task_id:
        raise HTTPException(409, "El trabajo ya está programado.")
    quote = repo.quote(db, item.company_id, payload.quote_id)
    location = location_access_service.require_location_capability(db, user, item.location_id, "can_manage_tasks", permission_code="work.manage")
    if quote is None or quote.client_id != location.client_id:
        raise HTTPException(422, "El presupuesto debe pertenecer al cliente de la ubicación.")
    item.quote_id = quote.id
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ese presupuesto ya está vinculado a otra petición.")
    return serialize(db, user, item)


def schedule(db, user, item_id, payload):
    item = editable(db, user, item_id)
    if item.task_id:
        return serialize(db, user, item)
    quote = repo.quote(db, item.company_id, item.quote_id) if item.quote_id else None
    contract = repo.contract(db, item.company_id, item.quote_id) if quote else None
    if not quote or quote.status != "accepted" or not contract:
        raise HTTPException(409, "Vincula y acepta el presupuesto antes de programar.")
    active_locations = [link.location_id for link in contract.covered_locations if link.is_active]
    if active_locations != [item.location_id]:
        raise HTTPException(409, "El contrato de este trabajo adicional debe cubrir únicamente su ubicación.")
    work_order_service._validate_contract_coverage(db, company_id=item.company_id, location_id=item.location_id,
                                                  service_contract_id=contract.id, occurrence_at=payload.starts_at)
    order = WorkOrder(company_id=item.company_id, location_id=item.location_id, service_contract_id=contract.id,
                      title=item.title, description=item.description, status="completed", order_type="one_off",
                      scheduled_start_at=payload.starts_at, created_by_user_id=user.id)
    try:
        db.add(order)
        db.flush()
        task = task_item_service.create_task_item(db, user, TaskItemCreate(
            title=item.title, description=item.description, location_id=item.location_id,
            scheduled_start_at=payload.starts_at, price=contract.quote_snapshot["base_amount"],
            quantity=1, unit="service", service_context="contract"), work_order_id=order.id, commit=False)
        item.task_id = task.id
        db.commit()
    except Exception:
        db.rollback()
        raise
    task_item_service.publish_created_task(db, task)
    return serialize(db, user, item)
