"""Scoped approval settings and purchase requests; execution stays canonical."""
from datetime import datetime,timezone
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from app.models.audit_log import AuditLog
from app.models.workflow_approval import OperationsApprovalPolicy,PurchaseApproval,PurchaseBudgetLink
from app.repositories import workflow_approval as repo
from app.services import workflow_approval_policy as policy,inventory_purchase_service
from app.services.entitlement_service import require_company_feature,company_feature_enabled
from app.services.organization_authorization_service import require_capability,has_capability
from app.services.user_scope import require_company_context
from app.schemas.inventory_purchase import InventoryPurchaseCreate


def audit(db,user,action,entity,id,details):
    db.add(AuditLog(company_id=user.company_id,actor_user_id=user.id,action=action,entity_type=entity,entity_id=str(id),details=details))


def settings(db,user):
    company=require_company_context(user)
    require_capability(db,user,"finance.read")
    row=repo.policy(db,company)
    return dict(purchases_required=bool(row and row.purchases_required),task_close_required=bool(row and row.task_close_required),
        available=company_feature_enabled(db,company_id=company,code="features.approvals"),can_manage=has_capability(db,user,"finance.manage"))


def save_settings(db,user,payload):
    company=require_company_context(user);require_capability(db,user,"finance.manage")
    if payload.purchases_required or payload.task_close_required:require_company_feature(db,company_id=company,code="features.approvals")
    row=repo.policy(db,company)
    if row is None:row=OperationsApprovalPolicy(company_id=company);db.add(row)
    for key,value in payload.model_dump().items():setattr(row,key,value)
    row.updated_by=user.id
    audit(db,user,"approvals.policy_changed","company",company,payload.model_dump())
    db.commit();return settings(db,user)


def principal(db,user,manage=False):
    company=require_company_context(user)
    require_company_feature(db,company_id=company,code="features.approvals")
    require_capability(db,user,"inventory.manage" if manage else "inventory.read")
    require_capability(db,user,"finance.manage" if manage else "finance.read")
    return company


def serialize(row):
    source=row.budget_link.request if row.budget_link else None
    return dict(source_request=dict(id=source.id,description=source.description,amount=str(source.amount),status=source.status) if source else None,id=row.id,status=row.status,fingerprint=row.fingerprint,purchase=row.payload,purchase_id=row.purchase_id,
        requested_by=row.requested_by,created_at=row.created_at,reviewed_by=row.reviewed_by,reviewed_at=row.reviewed_at,note=row.note)


def list_purchases(db,user):
    company=principal(db,user)
    return [serialize(row) for row in repo.proposals(db,company).order_by(PurchaseApproval.id.desc()).limit(200)]


def submit_purchase(db,user,payload,source_request_id=None):
    company=principal(db,user)
    require_capability(db,user,"inventory.manage")
    inventory_purchase_service._validate_purchase_references(db,company_id=company,payload=payload)
    source=validate_source(db,company,source_request_id,payload)
    if source is not None and source.purchase_link:raise HTTPException(409,"Esta solicitud ya tiene una compra en revisión o registrada.")
    try:
        row=PurchaseApproval(company_id=company,requested_by=user.id,payload=payload.model_dump(mode="json"),fingerprint=policy.purchase_digest(payload))
        db.add(row);db.flush()
        if source is not None:db.add(PurchaseBudgetLink(approval=row,request=source,active_request_id=source.id))
        audit(db,user,"purchase.approval_requested","purchase_approval",row.id,{"fingerprint":row.fingerprint})
        db.commit();return serialize(row)
    except IntegrityError:
        db.rollback();raise HTTPException(409,"Esta autorización ya tiene una solicitud de compra. Actualiza el listado para revisar su estado.")


def decide_purchase(db,user,id,payload):
    company=principal(db,user,True)
    try:
        row=repo.proposal(db,company,id)
        if row is None:raise HTTPException(404,"Solicitud de compra no encontrada")
        if row.fingerprint!=payload.fingerprint:raise HTTPException(409,"La solicitud ha cambiado. Revisa de nuevo su contenido.")
        if row.status!="pending":
            if row.status==payload.decision:return serialize(row)
            raise HTTPException(409,"La solicitud ya tiene una decisión.")
        if payload.decision=="rejected" and not payload.note:raise HTTPException(422,"Indica el motivo del rechazo.")
        row.status=payload.decision;row.reviewed_by=user.id;row.reviewed_at=datetime.now(timezone.utc);row.note=payload.note
        if payload.decision=="approved":
            if row.budget_link:validate_source(db,company,row.budget_link.request_id,InventoryPurchaseCreate.model_validate(row.payload))
            purchase=inventory_purchase_service.create_purchase(db,user,InventoryPurchaseCreate.model_validate(row.payload),approval_id=row.id,commit=False)
            row.purchase_id=purchase.id
        if row.status=="rejected" and row.budget_link:row.budget_link.active_request_id=None
        audit(db,user,"purchase.approval_decided","purchase_approval",row.id,{"decision":row.status,"purchase_id":row.purchase_id})
        db.commit();return serialize(row)
    except Exception:db.rollback();raise


def source_requests(db,user):
    company=principal(db,user)
    return [dict(id=row.id,description=row.description,amount=str(row.amount)) for row in repo.source_requests(db,company).limit(200) if not row.purchase_link]


def validate_source(db,company,id,payload):
    if id is None:return None
    from decimal import Decimal
    source=repo.source_request(db,company,id)
    if source is None:raise HTTPException(404,"Solicitud de compra aprobada no encontrada.")
    total=inventory_purchase_service._expense_base_amount(payload)+Decimal(payload.tax_amount)
    if total>source.amount:raise HTTPException(409,"El total de la compra supera el importe autorizado en la solicitud. Revisa la autorización antes de continuar.")
    return source
