from fastapi import Depends, APIRouter, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, AsyncActiveUser, get_async_db, get_db
from app.api.pagination import PaginationLimit, PaginationOffset
from app.api.v1 import client_contacts, client_opportunities
from app.services import client_authorization_service, client_service
from app.schemas.client import (
    ClientCreate,
    ClientAccessResponse,
    ClientEmailRequest,
    ClientResponse,
    ClientUpdate,
)
from app.models.user import User
from app.services import audit_service
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit

router = APIRouter()
router.include_router(client_contacts.router, prefix="/{client_id}")
router.include_router(client_opportunities.router, prefix="/{client_id}")


@router.get("/", response_model=list[ClientResponse])
async def read_clients(
    is_active: bool | None = True,
    include_inactive: bool = False,
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: client_service.get_clients(
            sync_db,
            client_authorization_service.require_client_capability(
                sync_db,
                current_user,
                client_authorization_service.CAPABILITY_CLIENTS_READ,
            ),
            skip,
            limit,
            None if include_inactive else is_active,
        )
    )


@router.get("/access", response_model=ClientAccessResponse)
async def read_client_access(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: ClientAccessResponse(
            can_read_clients=client_authorization_service.has_client_capability(
                sync_db,
                current_user,
                client_authorization_service.CAPABILITY_CLIENTS_READ,
            ),
            can_manage_clients=client_authorization_service.has_client_capability(
                sync_db,
                current_user,
                client_authorization_service.CAPABILITY_CLIENTS_MANAGE,
            ),
            can_read_commercial_follow_ups=client_authorization_service.has_client_capability(
                sync_db,
                current_user,
                client_authorization_service.CAPABILITY_COMMERCIAL_FOLLOW_UPS_READ,
            ),
            can_manage_commercial_follow_ups=client_authorization_service.has_client_capability(
                sync_db,
                current_user,
                client_authorization_service.CAPABILITY_COMMERCIAL_FOLLOW_UPS_MANAGE,
            ),
        )
    )


@router.get("/{client_id}", response_model=ClientResponse)
async def read_client(
    client_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: client_service.get_client(
            sync_db,
            client_authorization_service.require_client_capability(
                sync_db,
                current_user,
                client_authorization_service.CAPABILITY_CLIENTS_READ,
            ),
            client_id,
        )
    )


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    client_data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    client_data.company_id = client_authorization_service.require_client_capability(
        db,
        current_user,
        client_authorization_service.CAPABILITY_CLIENTS_MANAGE,
    )
    return client_service.create_client(db, client_data)


@router.patch("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    client_update: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    company_id = client_authorization_service.require_client_capability(
        db,
        current_user,
        client_authorization_service.CAPABILITY_CLIENTS_MANAGE,
    )
    return client_service.update_client(
        db, company_id, client_id, client_update
    )


@router.post("/{client_id}/send-email")
def send_client_email(
    client_id: int,
    data: ClientEmailRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    company_id = client_authorization_service.require_client_capability(
        db,
        current_user,
        client_authorization_service.CAPABILITY_CLIENTS_MANAGE,
    )
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
    current_user: User = ActiveUser,
):
    company_id = client_authorization_service.require_client_capability(
        db,
        current_user,
        client_authorization_service.CAPABILITY_CLIENTS_MANAGE,
    )
    return client_service.delete_client(db, company_id, client_id)
