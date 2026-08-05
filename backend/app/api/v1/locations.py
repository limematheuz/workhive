from datetime import date

from fastapi import Depends, APIRouter, status, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from app.api.deps import (
    ActiveAdmin,
    ActiveManagerOrAdmin,
    AsyncActiveManagerOrAdmin,
    AsyncActiveUser,
    get_async_db,
    get_db,
)
from app.api.pagination import PaginationLimit, PaginationOffset
from app.schemas.location import LocationCreate, LocationUpdate, LocationResponse
from app.schemas.company import CompanyPartnerResponse
from app.schemas.user import UserResponse
from app.schemas.location_history import LocationHistoryPeriod, LocationOperationalHistoryResponse
from app.services import location_service, location_history_service
from app.models.user import User
from app.services import location_access_service
from app.services.user_scope import is_platform_superadmin, scoped_company_id

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
    return await db.run_sync(
        lambda sync_db: location_history_service.get_operational_history(
            sync_db,
            current_user,
            location_id=location_id,
            period=period,
            anchor_date=anchor_date,
            completed_offset=completed_offset,
            sessions_offset=sessions_offset,
            limit=limit,
        )
    )


@router.get("/", response_model=list[LocationResponse])
async def read_locations(
    client_id: int | None = None,
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    if is_platform_superadmin(current_user):
        return []

    def operation(sync_db: Session):
        locations = location_service.get_locations(
            sync_db,
            scoped_company_id(current_user),
            client_id,
            skip,
            limit,
        )
        responses = []
        for location in locations:
            response = LocationResponse.model_validate(location)
            response.can_manage_reservations = (
                location_access_service.has_location_capability_loaded(
                    current_user,
                    location,
                    "can_manage_reservations",
                )
            )
            response.can_manage_tasks = (
                location_access_service.has_location_capability_loaded(
                    current_user,
                    location,
                    "can_manage_tasks",
                )
            )
            response.shared_companies = [
                access.company_id for access in location.company_access
            ]
            responses.append(response)
        return responses

    return await db.run_sync(operation)


@router.get("/{location_id}", response_model=LocationResponse)
async def read_location(
    location_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    def operation(sync_db: Session):
        location = location_service.get_location(
            sync_db,
            location_id,
            scoped_company_id(current_user),
        )
        response = LocationResponse.model_validate(location)
        response.can_manage_reservations = (
            location_access_service.has_location_capability_loaded(
                current_user,
                location,
                "can_manage_reservations",
            )
        )
        response.can_manage_tasks = (
            location_access_service.has_location_capability_loaded(
                current_user,
                location,
                "can_manage_tasks",
            )
        )
        response.shared_companies = [
            access.company_id for access in location.company_access
        ]
        return response

    return await db.run_sync(operation)


@router.post("/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def create_location(
    location_data: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    company_id = scoped_company_id(current_user)
    return location_service.create_location(db, company_id, location_data)


@router.patch("/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: int,
    location_update: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    company_id = scoped_company_id(current_user)
    return location_service.update_location(
        db, location_id, location_update, company_id
    )


@router.delete("/{location_id}", response_model=LocationResponse)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin
):
    location_access_service.require_location_owner(db, current_user, location_id)
    company_id = scoped_company_id(current_user)
    return location_service.delete_location(db, location_id, company_id)


@router.get("/{location_id}/users", response_model=list[UserResponse])
async def read_location_users(
    location_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    def operation(sync_db: Session):
        location_access_service.require_accessible_location(
            sync_db,
            current_user,
            location_id,
        )

        from app.models.location import Location

        location = sync_db.query(Location).filter(Location.id == location_id).first()
        if not location:
            raise HTTPException(status_code=404, detail="Location not found")
        if not current_user.company_id:
            return []

        from app.models.user import User as DBUser

        return (
            sync_db.query(DBUser)
            .filter(
                DBUser.company_id == current_user.company_id,
                DBUser.is_active.is_(True),
            )
            .all()
        )

    return await db.run_sync(operation)


@router.get(
    "/{location_id}/service-providers",
    response_model=list[CompanyPartnerResponse],
)
async def read_location_service_providers(
    location_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveManagerOrAdmin,
):
    def operation(sync_db: Session):
        return location_service.get_location_service_providers(
            sync_db,
            current_user,
            location_id,
        )

    return await db.run_sync(operation)
