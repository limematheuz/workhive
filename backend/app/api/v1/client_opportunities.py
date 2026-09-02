from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, AsyncActiveUser, get_async_db, get_db
from app.models.user import User
from app.schemas.client_sales import (
    ClientOpportunityActivityCreate,
    ClientOpportunityActivityResponse,
    ClientOpportunityCreate,
    ClientOpportunityOwnerResponse,
    ClientOpportunityResponse,
    ClientOpportunityUpdate,
)
from app.services import client_authorization_service, client_opportunity_service


router = APIRouter()


@router.get("/opportunities", response_model=list[ClientOpportunityResponse])
async def read_client_opportunities(
    client_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: client_opportunity_service.list_opportunities(
            sync_db,
            client_authorization_service.require_client_capability(
                sync_db,
                current_user,
                client_authorization_service.CAPABILITY_COMMERCIAL_FOLLOW_UPS_READ,
            ),
            client_id,
        )
    )


@router.get(
    "/opportunity-owners", response_model=list[ClientOpportunityOwnerResponse]
)
def read_client_opportunity_owners(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return client_opportunity_service.list_owners(
        db,
        client_authorization_service.require_client_capability(
            db,
            current_user,
            client_authorization_service.CAPABILITY_COMMERCIAL_FOLLOW_UPS_MANAGE,
        ),
        client_id,
    )


@router.post(
    "/opportunities",
    response_model=ClientOpportunityResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_client_opportunity(
    client_id: int,
    payload: ClientOpportunityCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return client_opportunity_service.create_opportunity(
        db,
        client_authorization_service.require_client_capability(
            db,
            current_user,
            client_authorization_service.CAPABILITY_COMMERCIAL_FOLLOW_UPS_MANAGE,
        ),
        client_id,
        payload,
        current_user,
    )


@router.patch(
    "/opportunities/{opportunity_id}", response_model=ClientOpportunityResponse
)
def update_client_opportunity(
    client_id: int,
    opportunity_id: int,
    payload: ClientOpportunityUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return client_opportunity_service.update_opportunity(
        db,
        client_authorization_service.require_client_capability(
            db,
            current_user,
            client_authorization_service.CAPABILITY_COMMERCIAL_FOLLOW_UPS_MANAGE,
        ),
        client_id,
        opportunity_id,
        payload,
        current_user,
    )


@router.get(
    "/opportunities/{opportunity_id}/activities",
    response_model=list[ClientOpportunityActivityResponse],
)
async def read_client_opportunity_activities(
    client_id: int,
    opportunity_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: client_opportunity_service.list_activities(
            sync_db,
            client_authorization_service.require_client_capability(
                sync_db,
                current_user,
                client_authorization_service.CAPABILITY_COMMERCIAL_FOLLOW_UPS_READ,
            ),
            client_id,
            opportunity_id,
        )
    )


@router.post(
    "/opportunities/{opportunity_id}/activities",
    response_model=ClientOpportunityActivityResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_client_opportunity_activity(
    client_id: int,
    opportunity_id: int,
    payload: ClientOpportunityActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return client_opportunity_service.create_activity(
        db,
        client_authorization_service.require_client_capability(
            db,
            current_user,
            client_authorization_service.CAPABILITY_COMMERCIAL_FOLLOW_UPS_MANAGE,
        ),
        client_id,
        opportunity_id,
        payload,
        current_user,
    )
