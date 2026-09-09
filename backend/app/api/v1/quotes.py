from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, APIRouter, Request, status
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from app.api.deps import (
    ActiveFinanceManager,
    ActiveFinanceReader,
    AsyncActiveFinancialReader,
    get_async_db,
    get_db,
)
from app.api.pagination import PaginationLimit, PaginationOffset
from app.models.user import User
from app.schemas.quote import (
    QuoteAcceptRequest,
    QuoteCreate,
    QuoteEmailRequest,
    QuoteResponse,
    QuoteUpdate,
)
from app.schemas.quote_item import QuoteItemCreate, QuoteItemUpdate, QuoteItemResponse
from app.services import (
    audit_service,
    quote_item_service,
    quote_service,
)
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.services.user_scope import is_platform_superadmin


router = APIRouter()


@router.get("/", response_model=list[QuoteResponse])
async def read_quotes(
    client_id: int | None = None,
    quote_status: str | None = None,
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    if is_platform_superadmin(current_user):
        return []
    return await db.run_sync(
        lambda sync_db: quote_service.get_quotes(
            sync_db,
            current_user.company_id,
            client_id,
            quote_status,
            skip,
            limit,
        )
    )


@router.get("/{quote_id}", response_model=QuoteResponse)
async def read_quote(
    quote_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: quote_service.get_quote(
            sync_db,
            current_user.company_id,
            quote_id,
        )
    )


@router.get("/{quote_id}/pdf", response_class=FileResponse)
def download_quote_pdf(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceReader,
):
    quote, path = quote_service.get_quote_pdf(
        db,
        current_user.company_id,
        quote_id,
    )
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=f"{quote.quote_number}.pdf",
        background=BackgroundTask(path.unlink, missing_ok=True),
    )


@router.post("/", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
def create_quote(
    quote_data: QuoteCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    return quote_service.create_quote(db, current_user.company_id, quote_data)


@router.post("/{quote_id}/send-email")
def send_quote_email(
    quote_id: int,
    data: QuoteEmailRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    enforce_rate_limit(
        request,
        "quote-email",
        settings.INVOICE_EMAIL_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=f"{current_user.id}:{quote_id}",
    )
    quote, recipient_email = quote_service.email_quote(
        db,
        current_user.company_id,
        quote_id,
        data,
        sender_email=current_user.email,
        actor_user_id=current_user.id,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=quote.company_id,
        action="quote.emailed",
        entity_type="quote",
        entity_id=quote.id,
        request=request,
        details={
            "quote_number": quote.quote_number,
            "recipient_source": (
                "override"
                if data.recipient_email or data.recipient_emails
                else "quote"
            ),
        },
    )
    return {"status": "sent", "recipient_email": recipient_email}


@router.patch("/{quote_id}", response_model=QuoteResponse)
def update_quote(
    quote_id: int,
    quote_data: QuoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    return quote_service.update_quote(
        db,
        current_user.company_id,
        quote_id,
        quote_data,
        actor_user_id=current_user.id,
    )


@router.post("/{quote_id}/accept", response_model=QuoteResponse)
def accept_quote(
    quote_id: int,
    accept_data: QuoteAcceptRequest,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    return quote_service.accept_quote(
        db,
        current_user.company_id,
        quote_id,
        accept_data,
        actor_user_id=current_user.id,
    )


@router.delete("/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    quote_service.delete_quote(db, current_user.company_id, quote_id)


# ---- Items ----

@router.get("/{quote_id}/items", response_model=list[QuoteItemResponse])
async def read_quote_items(
    quote_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: quote_item_service.get_quote_items(
            sync_db,
            current_user.company_id,
            quote_id,
        )
    )


@router.post(
    "/{quote_id}/items",
    response_model=QuoteItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_quote_item(
    quote_id: int,
    item_data: QuoteItemCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    return quote_item_service.create_quote_item(
        db, current_user.company_id, quote_id, item_data
    )


@router.patch("/{quote_id}/items/{item_id}", response_model=QuoteItemResponse)
def update_quote_item(
    quote_id: int,
    item_id: int,
    item_data: QuoteItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    return quote_item_service.update_quote_item(
        db, current_user.company_id, quote_id, item_id, item_data
    )


@router.delete("/{quote_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote_item(
    quote_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    quote_item_service.delete_quote_item(
        db, current_user.company_id, quote_id, item_id
    )
