from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import ActiveAdmin, get_db
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse
from app.services import audit_service


router = APIRouter()


@router.get("/", response_model=list[AuditLogResponse])
def read_audit_logs(
    company_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return audit_service.list_events(
        db,
        current_user,
        company_id=company_id,
        skip=skip,
        limit=limit,
    )
