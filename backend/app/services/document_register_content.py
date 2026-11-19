import hashlib,json
from datetime import date
from fastapi import HTTPException
from app.repositories import document_register as repo
from app.services.storage_service import get_object_storage,ObjectNotFoundError

STATEMENT_VERSION="document-simple-signature-v1"
CONSENT="He abierto y revisado esta revisión del documento y confirmo mi firma electrónica simple sobre su contenido y datos. No se trata de una firma cualificada."


def revision_hash(row):
    data={key:str(getattr(row,key)) for key in ("document_id","revision","title","sha256","expires_on")}
    return hashlib.sha256(json.dumps(data,sort_keys=True,separators=(",",":")).encode()).hexdigest()


def stored_bytes(revision):
    try:content=get_object_storage().get(revision.storage_key).contents
    except ObjectNotFoundError:raise HTTPException(404,"El archivo no está disponible.")
    if hashlib.sha256(content).hexdigest()!=revision.sha256:raise HTTPException(409,"La integridad del archivo no coincide con esta revisión. No puede firmarse ni descargarse.")
    return content


def signature(row,name=None):
    return dict(id=row.id,user_id=row.user_id,user_name=name,signer_name=row.signer_name,signed_at=row.signed_at,revision_hash=row.revision_hash,statement_version=row.statement_version)


def revision(row,signatures=()):
    return dict(id=row.id,revision=row.revision,title=row.title,file_name=row.file_name,content_type=row.content_type,size_bytes=row.size_bytes,sha256=row.sha256,revision_hash=row.revision_hash,expires_on=row.expires_on,expired=bool(row.expires_on and row.expires_on<date.today()),created_at=row.created_at,download_url=f"/api/v1/document-register/{row.document_id}/revisions/{row.id}/download",signatures=[signature(s,n) for s,n in signatures if s.revision_id==row.id])


def response(row,revisions,signatures,owner_name,manage=False,can_publish=False):
    versions=[v for v in revisions if v.document_id==row.id]
    return dict(id=row.id,source_type=None,source_id=None,owner_type=row.owner_type,owner_id=row.owner_id,owner_name=owner_name,title=row.title,document_type=row.document_type,published_revision=row.published_revision,current=revision(versions[0],signatures) if versions else None,can_manage=manage,can_sign=True,can_publish=can_publish)


def metadata(employee,file_id):
    prefix=f"/api/v1/staff-files/{file_id}/download"
    return next((d for d in (employee.profile or {}).get("documents",[]) if d.get("url")==prefix),{})


def legacy(row,kind,owner,manage):
    info=metadata(owner,row.id) if kind=="staff" else {}
    expires=info.get("expires_on")
    return dict(id=None,source_type="staff_file" if kind=="staff" else "location_document",source_id=row.id,owner_type=kind,owner_id=owner.id,owner_name=owner.name,title=info.get("name",row.name),document_type=info.get("document_type",getattr(row,"document_type","other")),published_revision=None,can_manage=manage,can_sign=True,can_publish=False,current=dict(id=None,revision=1,title=info.get("name",row.name),file_name=row.name,content_type=row.content_type,size_bytes=row.size_bytes,sha256=row.sha256,revision_hash=None,expires_on=expires,expired=bool(expires and expires<date.today().isoformat()),created_at=row.created_at,signatures=[],download_url=f"/api/v1/staff-files/{row.id}/download" if kind=="staff" else f"/api/v1/locations/{row.location_id}/documents/{row.id}/download"))
