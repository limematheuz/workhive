from hashlib import sha256
from fastapi import HTTPException
from app.models.staff_document_file import StaffDocumentFile
from app.repositories import staff_document_file as repo,staff as staff_repo,staff_account as account_repo
from app.services.location_asset_service import _validated_document,_safe_name,document_storage_limit,DOCUMENT_STORAGE_ENTITLEMENT
from app.services.storage_service import get_object_storage,ObjectNotFoundError,build_document_key
from app.services import entitlement_service
from app.services.organization_authorization_service import require_capability,has_capability
from app.services.user_scope import require_company_context


def _store(db,user,company,employee_id,filename,content_type,content):
    if staff_repo.employee(db,company,employee_id) is None:raise HTTPException(404,"Trabajador no encontrado")
    detected,extension=_validated_document(content,content_type,size_limit=document_storage_limit(db,company))
    entitlement_service.require_byte_quota(db,company_id=company,code=DOCUMENT_STORAGE_ENTITLEMENT,requested_bytes=len(content),
        current_usage=lambda:repo.used_bytes(db,company),resource_label="documentos de personal")
    key=build_document_key(company,f"staff/{employee_id}",extension)
    get_object_storage().put(key,content,detected)
    row=StaffDocumentFile(company_id=company,employee_id=employee_id,name=_safe_name(filename,extension),
        storage_key=key,content_type=detected,size_bytes=len(content),sha256=sha256(content).hexdigest(),created_by=user.id)
    db.add(row)
    return row


def upload(db,user,employee_id,filename,content_type,content):
    company=require_company_context(user)
    require_capability(db,user,"labor_costs.manage")
    row=_store(db,user,company,employee_id,filename,content_type,content)
    try:db.commit()
    except Exception:
        db.rollback();get_object_storage().delete(row.storage_key);raise
    return dict(name=row.name,url=f"/api/v1/staff-files/{row.id}/download")


def deliver_payroll(db,user,company,employee_id,month,filename,content_type,content):
    from datetime import datetime
    from copy import deepcopy
    from app.services.advisory_service import require_area
    require_area(db,user,company,"payroll")
    if user.role.name!="external_portal":require_capability(db,user,"labor_costs.manage")
    try:
        parsed=datetime.strptime(month,"%Y-%m")
        if parsed.strftime("%Y-%m")!=month:raise ValueError()
    except ValueError:raise HTTPException(422,"Selecciona un mes válido.")
    employee=staff_repo.employee(db,company,employee_id)
    if employee is None:raise HTTPException(404,"Trabajador no encontrado")
    if len((employee.profile or {}).get("documents",[]))>=100:raise HTTPException(409,"El trabajador ya tiene 100 documentos. Archiva los que no necesites antes de añadir otro.")
    row=_store(db,user,company,employee_id,filename,content_type,content)
    try:
        if row.content_type!="application/pdf":raise HTTPException(422,"La nómina debe ser un PDF.")
        db.flush()
        profile=deepcopy(employee.profile or {})
        documents=profile.get("documents",[])
        # Versions are retained, and a changed file requires a fresh receipt.
        existing=None
        for previous in documents:
            if previous.get("document_type")!="payroll" or previous.get("version")!=month:continue
            href=previous.get("url","")
            if href.startswith("/api/v1/staff-files/"):
                stored=repo.get(db,int(href.split("/")[-2]))
                if stored and stored.employee_id==employee_id and stored.sha256==row.sha256:existing=previous;break
        if existing:
            db.rollback();get_object_storage().delete(row.storage_key)
            return existing
        document=dict(name=f"Nómina {month}",url=f"/api/v1/staff-files/{row.id}/download",document_type="payroll",version=month,expires_on=None)
        profile["documents"]=[*documents,document]
        employee.profile=profile
        db.commit()
        return document
    except Exception:
        db.rollback();get_object_storage().delete(row.storage_key);raise


def validate_owner(db,employee,documents):
    for document in documents:
        if document.url.startswith("/api/"):
            file_id=int(document.url.split("/")[-2])
            file=repo.get(db,file_id)
            if file is None or file.company_id!=employee.company_id or file.employee_id!=employee.id:
                raise HTTPException(422,"El archivo debe pertenecer a este trabajador.")


def download(db,user,file_id):
    row=repo.get(db,file_id)
    if row is None:raise HTTPException(404,"Documento no encontrado")
    if user.role.name=="external_portal":
        from app.services.advisory_service import require_area
        require_area(db,user,row.company_id,"payroll")
    else:
        company=require_company_context(user)
        if row.company_id!=company:raise HTTPException(404,"Documento no encontrado")
        own=account_repo.own_employee(db,company,user.id)
        if not own or own.id!=row.employee_id:
            require_capability(db,user,"labor_costs.read")
    try:
        return row,get_object_storage().get(row.storage_key).contents
    except ObjectNotFoundError:
        raise HTTPException(404,"El archivo no está disponible.")
