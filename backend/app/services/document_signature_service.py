from fastapi import HTTPException
from app.models.document_register import DocumentSignature
from app.repositories import document_register as repo
from app.services import document_register_service as register,document_register_content as content
from app.services import document_register_policy as policy
from app.services import client_portal_policy
from app.services.entitlement_service import require_company_feature


def _signature(db,user,row,revision,payload):
    if revision.revision!=payload.expected_revision or revision.revision_hash!=payload.expected_hash:raise HTTPException(409,"La revisión ha cambiado. Abre el documento y revísalo de nuevo antes de firmar.")
    content.stored_bytes(revision)
    existing=next((s for s,_ in repo.signatures(db,[revision.id]) if s.user_id==user.id),None)
    if existing:
        if existing.signer_name!=payload.signer_name:raise HTTPException(409,"Esta cuenta ya firmó la revisión con otro nombre declarado.")
        return existing
    signature=DocumentSignature(revision_id=revision.id,user_id=user.id,signer_name=payload.signer_name,revision_hash=revision.revision_hash,statement_version=content.STATEMENT_VERSION,consent_text=content.CONSENT)
    db.add(signature)
    register.audit(db,user,row,"document.signed",{"revision":revision.revision,"revision_hash":revision.revision_hash,"statement_version":content.STATEMENT_VERSION})
    return signature


def sign(db,user,id,revision_id,payload):
    try:
        row,owner=register.record(db,user,id)
        row=repo.document(db,id,True)
        versions=repo.revisions(db,[row.id]);revision=next((r for r in versions if r.id==revision_id),None)
        if revision is None:raise HTTPException(404,"Revisión no encontrada.")
        if not versions or versions[0].id!=revision.id:raise HTTPException(409,"Existe una revisión posterior. Revisa y firma la versión actual.")
        _signature(db,user,row,revision,payload);db.commit()
        return register.describe(db,row,owner,policy.can_manage(db,user,row))
    except Exception:db.rollback();raise


def publish(db,user,id,payload):
    try:
        row,owner=register.record(db,user,id,True)
        require_company_feature(db,company_id=row.company_id,code="features.client_portal")
        if row.owner_type=="staff" or row.owner_type=="location" and owner.client_id is None:raise HTTPException(422,"Selecciona un documento de cliente o de un centro vinculado a su cliente.")
        if payload.revision_id is None:row.published_revision=None
        else:
            revision=repo.revision(db,payload.revision_id)
            if revision is None or revision.document_id!=row.id or revision.revision_hash!=payload.expected_hash:raise HTTPException(409,"Revisión no verificada para publicar.")
            content.stored_bytes(revision);row.published_revision=revision.revision
        register.audit(db,user,row,"document.publication_changed",{"published_revision":row.published_revision});db.commit()
        return register.describe(db,row,owner,True)
    except Exception:db.rollback();raise


def portal_record(db,principal,id):
    grant=client_portal_policy.require_active_client_portal(db,current_user=principal.user,grant_id=principal.grant.id)
    require_company_feature(db,company_id=grant.company_id,code="features.client_portal")
    row=repo.client_document(db,grant,id)
    if row is None:raise HTTPException(404,"Documento publicado no encontrado.")
    revisions=repo.revisions(db,[row.id]);revision=next((r for r in revisions if r.revision==row.published_revision),None)
    if revision is None:raise HTTPException(404,"Revisión publicada no disponible.")
    return row,revision


def portal_response(db,principal,row,revision,known_signatures=None,owner_names=None):
    if row.owner_type=="location":
        name=(owner_names or {}).get(row.owner_id)
        if name is None:
            site=repo.owner(db,row.company_id,"location",row.owner_id)
            name=site.name if site else "Centro"
    else:name=principal.grant.client.name
    result=content.response(row,[revision],repo.signatures(db,[revision.id]) if known_signatures is None else known_signatures,name)
    result["title"]=revision.title
    result["current"]["download_url"]=f"/api/v1/client-portal/workspaces/{principal.grant.id}/documents/{row.id}/revisions/{revision.id}/download"
    result["current"]["signatures"]=[{k:v for k,v in s.items() if k not in {"user_id","user_name"}} for s in result["current"]["signatures"]]
    return result


def portal_list(db,principal,offset=0):
    grant=client_portal_policy.require_active_client_portal(db,current_user=principal.user,grant_id=principal.grant.id)
    require_company_feature(db,company_id=grant.company_id,code="features.client_portal")
    records=repo.client_documents(db,grant);page=records[offset:offset+100];revisions=repo.revisions(db,[r.id for r in page]);signatures=repo.signatures(db,[r.id for r in revisions])
    owner_names={site.id:site.name for site in repo.owners(db,grant.company_id,"location",[r.owner_id for r in page if r.owner_type=="location"])}
    return dict(records=[portal_response(db,principal,row,next(r for r in revisions if r.document_id==row.id and r.revision==row.published_revision),signatures,owner_names) for row in page],has_more=len(records)>offset+100,offset=offset,statement=content.CONSENT)


def portal_download(db,principal,id,revision_id):
    _,revision=portal_record(db,principal,id)
    if revision.id!=revision_id:raise HTTPException(404,"Revisión no publicada.")
    return revision,content.stored_bytes(revision)


def portal_sign(db,principal,id,revision_id,payload):
    try:
        from app.repositories.client_portal_quote import lock_grant
        if lock_grant(db,principal.grant.id,principal.user.id) is None:raise HTTPException(403,"El acceso al portal ya no está disponible.")
        row,revision=portal_record(db,principal,id);row=repo.document(db,id,True)
        if revision.id!=revision_id or revision.revision!=row.published_revision:raise HTTPException(409,"La publicación ha cambiado. Actualiza antes de firmar.")
        _signature(db,principal.user,row,revision,payload);db.commit()
        return portal_response(db,principal,row,revision)
    except Exception:db.rollback();raise
