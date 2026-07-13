from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AsyncActiveAdmin, get_async_db
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse
from app.services import audit_service


router = APIRouter()


@router.get("/", response_model=list[AuditLogResponse])
async def read_audit_logs(
    company_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveAdmin,
):
    return await db.run_sync(
        lambda sync_db: audit_service.list_events(
            sync_db,
            current_user,
            company_id=company_id,
            skip=skip,
            limit=limit,
        )
    )
