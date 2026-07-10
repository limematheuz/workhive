from sqlalchemy.orm import Session
from fastapi import Depends, APIRouter, status
from app.api.deps import get_db, ActiveAdmin
from app.models.user import User
from app.schemas.quote import QuoteCreate, QuoteUpdate, QuoteResponse
from app.schemas.quote_item import QuoteItemCreate, QuoteItemUpdate, QuoteItemResponse
from app.services import quote_service
from app.services.user_scope import is_platform_superadmin


router = APIRouter()


@router.get("/", response_model=list[QuoteResponse])
def read_quotes(
    client_id: int | None = None,
    quote_status: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    if is_platform_superadmin(current_user):
        return []
    return quote_service.get_quotes(
        db, current_user.company_id, client_id, quote_status, skip, limit
    )


@router.get("/{quote_id}", response_model=QuoteResponse)
def read_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return quote_service.get_quote(db, current_user.company_id, quote_id)


@router.post("/", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
def create_quote(
    quote_data: QuoteCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return quote_service.create_quote(db, current_user.company_id, quote_data)


@router.patch("/{quote_id}", response_model=QuoteResponse)
def update_quote(
    quote_id: int,
    quote_data: QuoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return quote_service.update_quote(
        db, current_user.company_id, quote_id, quote_data
    )


@router.delete("/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    quote_service.delete_quote(db, current_user.company_id, quote_id)


# ---- Items ----

@router.get("/{quote_id}/items", response_model=list[QuoteItemResponse])
def read_quote_items(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return quote_service.get_quote_items(db, current_user.company_id, quote_id)


@router.post(
    "/{quote_id}/items",
    response_model=QuoteItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_quote_item(
    quote_id: int,
    item_data: QuoteItemCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return quote_service.create_quote_item(
        db, current_user.company_id, quote_id, item_data
    )


@router.patch("/{quote_id}/items/{item_id}", response_model=QuoteItemResponse)
def update_quote_item(
    quote_id: int,
    item_id: int,
    item_data: QuoteItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return quote_service.update_quote_item(
        db, current_user.company_id, quote_id, item_id, item_data
    )


@router.delete("/{quote_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote_item(
    quote_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    quote_service.delete_quote_item(
        db, current_user.company_id, quote_id, item_id
    )
