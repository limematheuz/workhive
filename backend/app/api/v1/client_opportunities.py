from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import ActiveAdmin, AsyncActiveUser, get_async_db, get_db
from app.models.user import User
from app.schemas.client_sales import (
    ClientOpportunityActivityCreate,
    ClientOpportunityActivityResponse,
    ClientOpportunityCreate,
    ClientOpportunityOwnerResponse,
    ClientOpportunityResponse,
    ClientOpportunityUpdate,
)
from app.services import client_opportunity_service
from app.services.user_scope import scoped_company_id


router = APIRouter()


@router.get("/opportunities", response_model=list[ClientOpportunityResponse])
async def read_client_opportunities(
    client_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    company_id = scoped_company_id(current_user)
    return await db.run_sync(
        lambda sync_db: client_opportunity_service.list_opportunities(
            sync_db, company_id, client_id
        )
    )


@router.get(
    "/opportunity-owners", response_model=list[ClientOpportunityOwnerResponse]
)
def read_client_opportunity_owners(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return client_opportunity_service.list_owners(
        db, scoped_company_id(current_user), client_id
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
    current_user: User = ActiveAdmin,
):
    return client_opportunity_service.create_opportunity(
        db, scoped_company_id(current_user), client_id, payload, current_user
    )


@router.patch(
    "/opportunities/{opportunity_id}", response_model=ClientOpportunityResponse
)
def update_client_opportunity(
    client_id: int,
    opportunity_id: int,
    payload: ClientOpportunityUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return client_opportunity_service.update_opportunity(
        db,
        scoped_company_id(current_user),
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
    company_id = scoped_company_id(current_user)
    return await db.run_sync(
        lambda sync_db: client_opportunity_service.list_activities(
            sync_db, company_id, client_id, opportunity_id
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
    current_user: User = ActiveAdmin,
):
    return client_opportunity_service.create_activity(
        db,
        scoped_company_id(current_user),
        client_id,
        opportunity_id,
        payload,
        current_user,
    )
