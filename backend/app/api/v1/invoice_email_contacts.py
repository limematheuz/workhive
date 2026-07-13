from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ActiveAdmin, AsyncActiveUser, get_async_db, get_db
from app.models.user import User
from app.schemas.invoice_email_contact import (
    InvoiceEmailContactCreate,
    InvoiceEmailContactResponse,
)
from app.services import invoice_email_contact_service

router = APIRouter()


@router.get("/", response_model=list[InvoiceEmailContactResponse])
async def read_invoice_email_contacts(
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: invoice_email_contact_service.list_contacts(
            sync_db,
            current_user.company_id,
            query=q,
            limit=limit,
        )
    )


@router.post(
    "/",
    response_model=InvoiceEmailContactResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice_email_contact(
    data: InvoiceEmailContactCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return invoice_email_contact_service.save_contact(
        db,
        current_user.company_id,
        data,
    )
