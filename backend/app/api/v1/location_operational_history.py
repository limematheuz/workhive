from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import AsyncActiveUser, get_async_db
from app.models.user import User
from app.schemas.location_history import (
    LocationHistoryPeriod,
    LocationOperationalHistoryResponse,
)
from app.services import (
    location_access_service,
    location_history_service,
    organization_authorization_service,
)


router = APIRouter()


@router.get(
    "/{location_id}/operational-history",
    response_model=LocationOperationalHistoryResponse,
)
async def read_location_operational_history(
    location_id: int,
    period: LocationHistoryPeriod = "week",
    anchor_date: date | None = Query(default=None),
    completed_offset: int = Query(default=0, ge=0),
    sessions_offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    def operation(sync_db: Session):
        location_access_service.require_accessible_location(
            sync_db,
            current_user,
            location_id,
        )
        organization_authorization_service.require_capability(
            sync_db,
            current_user,
            "locations.read",
            scope_type="location",
            scope_id=location_id,
        )
        return location_history_service.get_operational_history(
            sync_db,
            current_user,
            location_id=location_id,
            period=period,
            anchor_date=anchor_date,
            completed_offset=completed_offset,
            sessions_offset=sessions_offset,
            limit=limit,
        )

    return await db.run_sync(operation)
