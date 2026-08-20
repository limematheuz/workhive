from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AsyncActiveFinancialReader, get_async_db
from app.models.user import User
from app.schemas.fiscal_summary import FiscalSummaryResponse
from app.services import fiscal_summary_service
from app.services.user_scope import is_platform_superadmin


router = APIRouter()
FiscalSummaryYear = Annotated[int, Query(ge=2000, le=2100)]


@router.get("/", response_model=FiscalSummaryResponse)
async def read_fiscal_summary(
    year: FiscalSummaryYear | None = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    if is_platform_superadmin(current_user) or current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company admin required",
        )
    selected_year = year or datetime.now(timezone.utc).year
    return await db.run_sync(
        lambda sync_db: fiscal_summary_service.get_summary(
            sync_db,
            current_user.company_id,
            year=selected_year,
        )
    )
