from fastapi import Depends, APIRouter, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from app.api.deps import ActiveAdmin, AsyncActiveUser, get_async_db, get_db
from app.api.pagination import PaginationLimit, PaginationOffset
from app.services import client_service
from app.services.user_scope import is_platform_superadmin, scoped_company_id
from app.schemas.client import (
    ClientContactCreate,
    ClientContactResponse,
    ClientContactUpdate,
    ClientCreate,
    ClientEmailRequest,
    ClientResponse,
    ClientUpdate,
)
from app.models.user import User
from app.services import audit_service
from app.services import client_contact_service
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit

router = APIRouter()


@router.get("/{client_id}/contacts", response_model=list[ClientContactResponse])
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
    "/{client_id}/contacts",
    response_model=ClientContactResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_client_contact(
    client_id: int,
    payload: ClientContactCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    company_id = scoped_company_id(current_user)
    return client_contact_service.create_client_contact(
        db, company_id, client_id, payload
    )


@router.patch("/{client_id}/contacts/{contact_id}", response_model=ClientContactResponse)
def update_client_contact(
    client_id: int,
    contact_id: int,
    payload: ClientContactUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    company_id = scoped_company_id(current_user)
    return client_contact_service.update_client_contact(
        db, company_id, client_id, contact_id, payload
    )


@router.delete("/{client_id}/contacts/{contact_id}", response_model=ClientContactResponse)
def deactivate_client_contact(
    client_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    company_id = scoped_company_id(current_user)
    return client_contact_service.deactivate_client_contact(
        db, company_id, client_id, contact_id
    )


@router.get("/", response_model=list[ClientResponse])
async def read_clients(
    is_active: bool | None = True,
    include_inactive: bool = False,
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    company_id = scoped_company_id(current_user)
    return await db.run_sync(
        lambda sync_db: client_service.get_clients(
            sync_db,
            company_id,
            skip,
            limit,
            None if include_inactive else is_active,
        )
    )


@router.get("/{client_id}", response_model=ClientResponse)
async def read_client(
    client_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    company_id = scoped_company_id(current_user)
    return await db.run_sync(
        lambda sync_db: client_service.get_client(sync_db, company_id, client_id)
    )


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    client_data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    if not is_platform_superadmin(current_user):
        client_data.company_id = current_user.company_id
    return client_service.create_client(db, client_data)


@router.patch("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    client_update: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    company_id = scoped_company_id(current_user)
    return client_service.update_client(
        db, company_id, client_id, client_update
    )


@router.post("/{client_id}/send-email")
def send_client_email(
    client_id: int,
    data: ClientEmailRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    company_id = scoped_company_id(current_user)
    enforce_rate_limit(
        request,
        "client-email",
        settings.INVOICE_EMAIL_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=f"{current_user.id}:{client_id}",
    )
    client, recipient_email = client_service.email_client(
        db,
        company_id,
        client_id,
        data,
        sender_email=current_user.email,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=client.company_id,
        action="client.emailed",
        entity_type="client",
        entity_id=client.id,
        request=request,
    )
    return {"status": "sent", "recipient_email": recipient_email}


@router.delete("/{client_id}", response_model=ClientResponse)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    company_id = scoped_company_id(current_user)
    return client_service.delete_client(db, company_id, client_id)
