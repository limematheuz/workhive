from app.services.work_order_execution_policy import accepts_execution_costs
from app.services.entitlement_service import require_company_feature
from datetime import date,datetime,timezone
from fastapi import HTTPException
from app.models.subcontract import Subcontract
from app.models.audit_log import AuditLog
from app.schemas.expense import ExpenseCreate
from app.services import expense_service
from app.repositories import subcontract as repo,inventory as inventory_repo
from app.services.organization_authorization_service import permitted_location_ids,require_capability
from app.services.user_scope import require_company_context
from app.services import work_order_inventory_service as operations


def serialize(row,order,supplier):
    return dict(id=row.id,work_order_id=order.id,work_order=order.title,location_id=order.location_id,
        supplier=supplier.name,supplier_id=supplier.id,amount=row.amount,description=row.description,
        document_url=row.document_url,document_expires_on=row.document_expires_on,status=row.status,expense_id=row.expense_id)


def read(db,user):
    company=require_company_context(user)
    require_company_feature(db,company_id=company,code="features.inventory")
    require_capability(db,user,"inventory.read")
    require_capability(db,user,"finance.read")
    locations=permitted_location_ids(db,user,"work.read")
    return [serialize(*item) for item in repo.rows(db,company,locations).order_by(Subcontract.id.desc()).limit(500)]


def save(db,user,payload,record_id=None):
    company=operations._company_id(db,user,inventory="inventory.manage",work="work.manage")
    require_company_feature(db,company_id=company,code="features.inventory")
    require_capability(db,user,"finance.manage")
    order=operations._work_order_or_404(db,user,company_id=company,work_order_id=payload.work_order_id,permission_code="work.manage")
    if order.status!="draft" and not accepts_execution_costs(db,order):raise HTTPException(409,"La orden ya está cerrada.")
    supplier=inventory_repo.get_supplier(db,company_id=company,supplier_id=payload.supplier_id)
    if supplier is None:raise HTTPException(404,"Proveedor no encontrado")
    row=None
    if record_id is not None:
        item=repo.rows(db,company,permitted_location_ids(db,user,"work.manage")).filter(Subcontract.id==record_id).with_for_update().first()
        if not item:raise HTTPException(404,"Subcontrata no encontrada")
        row=item[0]
        if row.status in {"completed","cancelled"}:raise HTTPException(409,"La subcontrata ya está cerrada.")
    if row is None:row=Subcontract(company_id=company);db.add(row)
    for key,value in payload.model_dump().items():setattr(row,key,value)
    db.commit()
    return serialize(row,order,supplier)


def review(db,user,record_id,payload):
    company=require_company_context(user)
    require_company_feature(db,company_id=company,code="features.inventory")
    require_capability(db,user,"inventory.manage")
    require_capability(db,user,"finance.manage")
    locations=permitted_location_ids(db,user,"work.manage")
    item=repo.rows(db,company,locations).filter(Subcontract.id==record_id).with_for_update().first()
    if not item:raise HTTPException(404,"Subcontrata no encontrada")
    row,order,supplier=item
    if row.status==payload.status:return serialize(*item)
    if row.status in {"completed","cancelled"}:raise HTTPException(409,"La subcontrata ya está cerrada.")
    if payload.status in {"progress","completed"} and not accepts_execution_costs(db,order):raise HTTPException(409,"El trabajo de esta orden ya está cerrado.")
    if payload.status in {"progress","completed"} and (not row.document_url or not row.document_expires_on or row.document_expires_on<date.today()):
        raise HTTPException(409,"Completa la documentación vigente antes de iniciar o validar el servicio.")
    if payload.status=="completed":
        expense=expense_service.create_expense(db,company_id=company,created_by_user_id=user.id,commit=False,
            data=ExpenseCreate(expense_date=datetime.now(timezone.utc),work_order_id=order.id,
            vendor=supplier.name,category="Subcontratas",description=row.description,base_amount=float(row.amount),
            tax_amount=0,notes=f"Servicio subcontratado #{row.id} validado."))
        row.expense_id=expense.id
    row.status=payload.status
    db.add(AuditLog(company_id=company,actor_user_id=user.id,action="subcontract.review",entity_type="subcontract",
        entity_id=str(row.id),details={"status":row.status,"expense_id":row.expense_id}))
    db.commit()
    return serialize(*item)
