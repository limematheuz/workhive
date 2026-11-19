from fastapi import HTTPException
from app.models.labor_communication import LaborCommunication,LaborCommunicationEvent
from app.models.audit_log import AuditLog
from app.repositories import labor_communication as repo
from app.services.advisory_service import require_area
from app.services.organization_authorization_service import require_capability,has_capability
from app.services.user_scope import require_company_context


def principal(db,user,company,manage=False):
    require_area(db,user,company,"payroll")
    external=user.role.name=="external_portal"
    if not external:
        if require_company_context(user)!=company:raise HTTPException(403,"Empresa no autorizada.")
        require_capability(db,user,"labor_costs.manage" if manage else "labor_costs.read",scope_type="company")
    elif manage:raise HTTPException(403,"La comunicación laboral debe proceder de la empresa.")
    return external


def serialize(row,events,names,documents):
    return dict(id=row.id,employee_id=row.employee_id,employee_name=names.get(row.employee_id,"Trabajador"),recipient_user_id=row.recipient_user_id,kind=row.kind,effective_on=row.effective_on,subject=row.subject,description=row.description,status=row.status,revision=row.revision,created_by=row.created_by,created_at=row.created_at,documents=[dict(revision_id=revision.id,document_id=document.id,title=revision.title,revision=revision.revision,sha256=revision.sha256,download_url=f"/api/v1/document-register/{document.id}/revisions/{revision.id}/download") for revision,document in documents if revision.id in row.document_revision_ids],events=[dict(id=e.id,status=e.status,note=e.note,actor_name=name,created_at=e.created_at) for e,name in events if e.communication_id==row.id])


def read(db,user,company,offset=0):
    external=principal(db,user,company)
    people=repo.employees(db,company);names={p.id:p.name for p in people}
    rows=repo.rows(db,company,user.id if external else None).order_by(LaborCommunication.id.desc()).offset(offset).limit(101).all()
    more=len(rows)>100;rows=rows[:100]
    events=repo.events(db,[r.id for r in rows]);documents=repo.documents(db,company,{id for r in rows for id in r.document_revision_ids})
    manage=not external and has_capability(db,user,"labor_costs.manage",scope_type="company")
    return dict(items=[serialize(r,events,names,documents) for r in rows],employees=[] if external else [dict(id=p.id,name=p.name) for p in people],recipients=[] if not manage else [dict(id=p.id,name=p.full_name,email=p.email) for p in repo.recipients(db,company)],can_create=manage,can_review=external,has_more=more,offset=offset)


def response(db,row):
    return serialize(row,repo.events(db,[row.id]),{p.id:p.name for p in repo.employees(db,row.company_id)},repo.documents(db,row.company_id,row.document_revision_ids))


def _event(db,user,row,status,note=""):
    db.add(LaborCommunicationEvent(communication_id=row.id,actor_user_id=user.id,status=status,note=note))
    db.add(AuditLog(company_id=row.company_id,actor_user_id=user.id,action="labor.communication_"+status,entity_type="labor_communication",entity_id=str(row.id),details={"employee_id":row.employee_id,"revision":row.revision,"recipient_user_id":row.recipient_user_id}))


def create(db,user,company,payload):
    try:
        principal(db,user,company,True)
        if not any(e.id==payload.employee_id for e in repo.employees(db,company)):raise HTTPException(404,"Trabajador no encontrado.")
        if not any(p.id==payload.recipient_user_id for p in repo.recipients(db,company)):raise HTTPException(422,"Selecciona una gestoría laboral activa autorizada en esta empresa.")
        documents=repo.documents(db,company,payload.document_revision_ids)
        if len(set(payload.document_revision_ids))!=len(payload.document_revision_ids) or len(documents)!=len(payload.document_revision_ids) or any(d.owner_type!="staff" or d.owner_id!=payload.employee_id for _,d in documents):raise HTTPException(422,"Adjunta sólo revisiones documentales de este trabajador y empresa.")
        row=LaborCommunication(company_id=company,created_by=user.id,**payload.model_dump())
        db.add(row);db.flush();_event(db,user,row,"sent");db.commit()
        return response(db,row)
    except Exception:db.rollback();raise


def decide(db,user,company,id,payload):
    try:
        external=principal(db,user,company,manage=payload.status=="cancelled")
        if payload.status!="cancelled" and not external:raise HTTPException(403,"La recepción y tramitación debe registrarla la gestoría destinataria.")
        row=repo.record(db,company,id,user.id if external else None)
        if row is None:raise HTTPException(404,"Comunicación no encontrada.")
        if row.revision!=payload.expected_revision:raise HTTPException(409,"La comunicación ha cambiado. Actualiza su seguimiento.")
        transitions={"sent":{"received","rejected","cancelled"},"received":{"processing","rejected","cancelled"},"processing":{"completed","rejected"}}
        if payload.status not in transitions.get(row.status,set()):raise HTTPException(409,"Esta transición ya no está disponible.")
        if payload.status in {"rejected","cancelled"} and not payload.note:raise HTTPException(422,"Indica el motivo de la devolución o cancelación.")
        row.status=payload.status;row.revision+=1;_event(db,user,row,payload.status,payload.note);db.commit()
        return response(db,row)
    except Exception:db.rollback();raise
