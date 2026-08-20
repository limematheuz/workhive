from datetime import date, datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AsyncActiveAdmin, get_async_db
from app.models.user import User
from app.schemas.client_profitability import ClientProfitabilityResponse
from app.services import client_profitability_service
from app.services.user_scope import is_platform_superadmin


router = APIRouter()
ProfitabilityPeriod = Literal["month", "year"]
ReferenceDate = Annotated[date | None, Query()]


@router.get("/", response_model=ClientProfitabilityResponse)
async def read_client_profitability(
    period: ProfitabilityPeriod = "month",
    reference_date: ReferenceDate = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveAdmin,
):
    if is_platform_superadmin(current_user) or current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company admin required",
        )
    return await db.run_sync(
        lambda sync_db: client_profitability_service.get_client_profitability(
            sync_db,
            current_user.company_id,
            period=period,
            reference_date=reference_date or datetime.now(timezone.utc).date(),
        )
    )
