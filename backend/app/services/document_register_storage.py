from hashlib import sha256
from copy import deepcopy
from fastapi import HTTPException
from app.models.staff_document_file import StaffDocumentFile
from app.models.location_document import LocationDocument
from app.repositories import document_register as repo,staff_document_file as staff_files
from app.services.location_asset_service import _validated_document,_safe_name,document_storage_limit,DOCUMENT_STORAGE_ENTITLEMENT
from app.services.storage_service import build_document_key,get_object_storage
from app.services import entitlement_service


def store(db,user,document,owner,filename,content_type,contents,revision_number,expires_on):
    company=document.company_id
    detected,extension=_validated_document(contents,content_type,size_limit=document_storage_limit(db,company))
    entitlement_service.require_byte_quota(db,company_id=company,code=DOCUMENT_STORAGE_ENTITLEMENT,requested_bytes=len(contents),current_usage=lambda:repo.used_bytes(db,company),resource_label="documentos")
    key=build_document_key(company,f"documents/{document.owner_type}/{owner.id}",extension)
    get_object_storage().put(key,contents,detected)
    values=dict(storage_key=key,file_name=_safe_name(filename,extension),content_type=detected,size_bytes=len(contents),sha256=sha256(contents).hexdigest())
    try:
        if document.owner_type=="staff":
            profile=deepcopy(owner.profile or {});documents=profile.get("documents",[])
            if len(documents)>=100:raise HTTPException(409,"Archiva documentación antigua de la ficha antes de añadir otra versión.")
            source=StaffDocumentFile(company_id=company,employee_id=owner.id,name=values["file_name"],created_by=user.id,**{k:v for k,v in values.items() if k!="file_name"})
            db.add(source);db.flush();values["staff_file_id"]=source.id
            previous=next((d for d in reversed(documents) if d.get("name")==document.title),{})
            item={**previous,"name":document.title,"url":f"/api/v1/staff-files/{source.id}/download","version":str(revision_number),"document_type":document.document_type if document.document_type in {"training","epi","contract","payroll","other"} else "other","expires_on":expires_on.isoformat() if expires_on else None}
            profile["documents"]=[*documents,item];owner.profile=profile
        elif document.owner_type=="location":
            source=LocationDocument(company_id=company,location_id=owner.id,name=values["file_name"],document_type=document.document_type,created_by_user_id=user.id,**{k:v for k,v in values.items() if k!="file_name"})
            db.add(source);db.flush();values["location_document_id"]=source.id
        return values,key
    except Exception:
        get_object_storage().delete(key);raise
