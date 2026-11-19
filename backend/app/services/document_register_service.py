from datetime import date
from fastapi import HTTPException
from app.models.document_register import RegisteredDocument,DocumentRevision
from app.models.audit_log import AuditLog
from app.repositories import document_register as repo
from app.services import document_register_policy as policy,document_register_content as content,document_register_storage as storage
from app.services.storage_service import get_object_storage
from app.services.entitlement_service import company_feature_enabled


def record(db,user,id,manage=False):
    row=repo.document(db,id,lock=manage)
    if row is None:raise HTTPException(404,"Documento no encontrado.")
    company=policy.company_context(db,user,row.company_id if user.role.name=="external_portal" else None)
    if row.company_id!=company:raise HTTPException(404,"Documento no encontrado.")
    owner=policy.authorize_owner(db,user,company,row.owner_type,row.owner_id,manage)
    return row,owner


def describe(db,row,owner,manage=False):
    revisions=repo.revisions(db,[row.id])
    publish=manage and (row.owner_type=="client" or row.owner_type=="location" and owner.client_id is not None) and company_feature_enabled(db,company_id=row.company_id,code="features.client_portal")
    return content.response(row,revisions,repo.signatures(db,[r.id for r in revisions]),owner.name,manage,publish)


def read(db,user,owner_type=None,owner_id=None,search="",company_id=None,offset=0):
    company=policy.company_context(db,user,company_id)
    allowed,managed,choices=policy.scopes(db,user,company)
    if owner_type:
        allowed={kind:ids if kind==owner_type else [] for kind,ids in allowed.items()}
    if owner_id:
        allowed={kind:[owner_id] if owner_id in ids else [] for kind,ids in allowed.items()}
    names={(kind,item.id):item for kind,rows in choices.items() for item in rows}
    documents=repo.records(db,company,allowed)
    revisions=repo.revisions(db,[r.id for r in documents]);signatures=repo.signatures(db,[r.id for r in revisions])
    publish_enabled=company_feature_enabled(db,company_id=company,code="features.client_portal")
    rows=[content.response(r,revisions,signatures,names[r.owner_type,r.owner_id].name,r.owner_id in managed[r.owner_type],publish_enabled and r.owner_id in managed[r.owner_type] and (r.owner_type=="client" or r.owner_type=="location" and names[r.owner_type,r.owner_id].client_id is not None)) for r in documents]
    for kind in ("staff","location"):
        rows.extend(content.legacy(item,kind,names[kind,item.employee_id if kind=="staff" else item.location_id],(item.employee_id if kind=="staff" else item.location_id) in managed[kind]) for item in repo.legacy_sources(db,company,kind,allowed[kind]))
    if search:rows=[r for r in rows if search.casefold() in (r["title"]+" "+r["owner_name"]+" "+r["document_type"]).casefold()]
    owners={plural:[dict(id=r.id,name=r.name,can_manage=r.id in managed[kind]) for r in choices[kind]] for kind,plural in (("client","clients"),("location","locations"),("staff","staff"))}
    rows.sort(key=lambda r:(r["title"].casefold(),r["owner_type"],r["owner_id"],r["id"] or 0,r["source_id"] or 0))
    return dict(records=rows[offset:offset+100],has_more=len(rows)>offset+100,offset=offset,owners=owners,statement=content.CONSENT)


def audit(db,user,row,action,details):
    db.add(AuditLog(company_id=row.company_id,actor_user_id=user.id,action=action,entity_type="registered_document",entity_id=str(row.id),details=details))


def link(db,user,payload):
    source=repo.source(db,payload.source_type,payload.source_id)
    if source is None or getattr(source,"archived_at",None):raise HTTPException(404,"Archivo no encontrado.")
    company=policy.company_context(db,user,source.company_id if user.role.name=="external_portal" else None)
    if source.company_id!=company:raise HTTPException(404,"Archivo no encontrado.")
    kind="staff" if payload.source_type=="staff_file" else "location"
    owner=policy.authorize_owner(db,user,company,kind,source.employee_id if kind=="staff" else source.location_id)
    existing=repo.source_record(db,payload.source_type,source.id)
    if existing:return describe(db,existing,owner,policy.can_manage(db,user,existing))
    metadata=content.metadata(owner,source.id) if kind=="staff" else {}
    row=RegisteredDocument(company_id=company,owner_type=kind,owner_id=owner.id,title=metadata.get("name",source.name),document_type=metadata.get("document_type",getattr(source,"document_type","other")),created_by=user.id)
    setattr(row,"origin_"+payload.source_type+"_id",source.id)
    try:
        db.add(row);db.flush()
        revision=DocumentRevision(document_id=row.id,revision=1,title=row.title,file_name=source.name,content_type=source.content_type,storage_key=source.storage_key,size_bytes=source.size_bytes,sha256=source.sha256,created_by=user.id,expires_on=date.fromisoformat(metadata["expires_on"]) if metadata.get("expires_on") else None)
        setattr(revision,payload.source_type+"_id",source.id)
        revision.revision_hash=content.revision_hash(revision);db.add(revision)
        audit(db,user,row,"document.registered",{"source_type":payload.source_type,"source_id":source.id});db.commit()
        return describe(db,row,owner,policy.can_manage(db,user,row))
    except Exception:db.rollback();raise


def upload(db,user,kind,owner_id,title,document_type,expires_on,filename,content_type,contents,document_id=None,expected_revision=None):
    key=None
    try:
        if not document_id and len(title)<2:raise HTTPException(422,"Indica un título para el documento.")
        company=policy.company_context(db,user)
        if document_id:
            row,owner=record(db,user,document_id,True)
            previous=repo.revisions(db,[row.id]);number=previous[0].revision if previous else 0
            if expected_revision!=number:raise HTTPException(409,"El documento tiene otra revisión. Actualiza antes de subir.")
        else:
            owner=policy.authorize_owner(db,user,company,kind,owner_id,True)
            row=RegisteredDocument(company_id=company,owner_type=kind,owner_id=owner_id,title=title,document_type=document_type,created_by=user.id)
            db.add(row);db.flush();number=0
        values,key=storage.store(db,user,row,owner,filename,content_type,contents,number+1,expires_on)
        revision=DocumentRevision(document_id=row.id,revision=number+1,title=title or row.title,expires_on=expires_on,created_by=user.id,**values)
        revision.revision_hash=content.revision_hash(revision);row.title=revision.title;db.add(revision)
        audit(db,user,row,"document.revision_created",{"revision":number+1,"sha256":revision.sha256});db.commit()
        return describe(db,row,owner,True)
    except Exception:
        db.rollback()
        if key:get_object_storage().delete(key)
        raise


def versions(db,user,id):
    row,_=record(db,user,id)
    revisions=repo.revisions(db,[row.id]);signatures=repo.signatures(db,[r.id for r in revisions])
    return [content.revision(r,signatures) for r in revisions]


def download(db,user,id,revision_id):
    row,_=record(db,user,id)
    revision=repo.revision(db,revision_id)
    if revision is None or revision.document_id!=row.id:raise HTTPException(404,"Revisión no encontrada.")
    return revision,content.stored_bytes(revision)
