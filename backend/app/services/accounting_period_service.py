from datetime import datetime,timezone
from fastapi import HTTPException
from app.models.accounting_period import AccountingPeriod,AccountingPeriodEvent
from app.models.audit_log import AuditLog
from app.repositories import accounting_period as repo,advisory as advisory_repo
from app.services.accounting_period_snapshot import dates,build
from app.services.advisory_service import require_area
from app.services.external_access_policy import is_external_portal_user
from app.services.organization_authorization_service import require_capability,has_capability
from app.services.user_scope import require_company_context


def access(db,user,company,action="read"):
    if is_external_portal_user(user):
        require_area(db,user,company,"accounting")
        grant=advisory_repo.grants(db,user.id,datetime.now(timezone.utc)).filter_by(company_id=company).first()
        settings=advisory_repo.area(db,grant.id) if grant else None
        can_close=bool(settings and settings.can_close_periods)
        if action=="reopen" or action=="close" and not can_close:raise HTTPException(403,"La gestoría no tiene autorización para esta acción sobre el periodo.")
        return dict(can_close=can_close,can_reopen=False)
    if company!=require_company_context(user):raise HTTPException(404,"Empresa no encontrada.")
    require_capability(db,user,"finance.read" if action=="read" else "finance.manage")
    manage=has_capability(db,user,"finance.manage")
    return dict(can_close=manage,can_reopen=manage)


def validate_month(month):
    try:return dates(month)
    except (ValueError,OverflowError):raise HTTPException(422,"Selecciona un mes contable válido.")


def serialize(row,month=None):
    return dict(month=row.month if row else month,status=row.status if row else "open",revision=row.revision if row else 0,
        closed_at=row.closed_at if row else None,reopened_at=row.reopened_at if row else None,snapshot=row.snapshot if row else None)


def read(db,user,company,month):
    rights=access(db,user,company);validate_month(month);row=repo.period(db,company,month)
    events=repo.events(db,company,row.id) if row else []
    return dict(**serialize(row,month),access=rights,current=build(db,company,month) if not row or row.status=="open" else None,
        history=[dict(id=event.id,action=event.action,revision=event.revision,reason=event.reason,actor_id=event.actor_id,created_at=event.created_at,snapshot=event.snapshot) for event in events])


def change(db,user,company,month,payload,action):
    access(db,user,company,action);validate_month(month)
    try:
        repo.lock_company(db,company)
        row=repo.period(db,company,month)
        revision=row.revision if row else 0
        if revision!=payload.expected_revision:raise HTTPException(409,"El periodo cambió. Actualiza la pantalla antes de continuar.")
        if action=="close" and row and row.status=="closed":raise HTTPException(409,"El periodo ya está cerrado.")
        if action=="reopen" and (row is None or row.status!="closed"):raise HTTPException(409,"Solo se puede reabrir un periodo cerrado.")
        if row is None:row=AccountingPeriod(company_id=company,month=month);db.add(row)
        now=datetime.now(timezone.utc);row.revision=revision+1
        if action=="close":
            row.snapshot=build(db,company,month);row.status="closed";row.closed_at=now;row.closed_by=user.id
        else:row.status="open";row.reopened_at=now;row.reopened_by=user.id
        db.flush()
        db.add(AccountingPeriodEvent(period_id=row.id,company_id=company,action="closed" if action=="close" else "reopened",revision=row.revision,reason=payload.reason,actor_id=user.id,snapshot=row.snapshot))
        db.add(AuditLog(company_id=company,actor_user_id=user.id,action="accounting.period_"+action,entity_type="accounting_period",entity_id=str(row.id),details=dict(month=month,revision=row.revision,reason=payload.reason,fingerprint=(row.snapshot or {}).get("fingerprint"))))
        db.commit()
    except Exception:db.rollback();raise
    return read(db,user,company,month)
