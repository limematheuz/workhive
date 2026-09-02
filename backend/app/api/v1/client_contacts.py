from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import ActiveAdmin, AsyncActiveUser, get_async_db, get_db
from app.models.user import User
from app.schemas.client import (
    ClientContactCreate,
    ClientContactResponse,
    ClientContactUpdate,
)
from app.services import client_contact_service
from app.services.user_scope import scoped_company_id


router = APIRouter()


@router.get("/contacts", response_model=list[ClientContactResponse])
async def read_client_contacts(
    client_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    company_id = scoped_company_id(current_user)
    return await db.run_sync(
        lambda sync_db: client_contact_service.list_client_contacts(
            sync_db, company_id, client_id
        )
    )


@router.post(
    "/contacts",
    response_model=ClientContactResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_client_contact(
    client_id: int,
    payload: ClientContactCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return client_contact_service.create_client_contact(
        db, scoped_company_id(current_user), client_id, payload
    )


@router.patch("/contacts/{contact_id}", response_model=ClientContactResponse)
def update_client_contact(
    client_id: int,
    contact_id: int,
    payload: ClientContactUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return client_contact_service.update_client_contact(
        db, scoped_company_id(current_user), client_id, contact_id, payload
    )


@router.delete("/contacts/{contact_id}", response_model=ClientContactResponse)
def deactivate_client_contact(
    client_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return client_contact_service.deactivate_client_contact(
        db, scoped_company_id(current_user), client_id, contact_id
    )
