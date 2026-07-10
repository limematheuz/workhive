from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.repositories import quote as quote_repo
from app.repositories import quote_item as quote_item_repo
from app.repositories import client as client_repo
from app.schemas.quote import QuoteCreate, QuoteUpdate
from app.schemas.quote_item import QuoteItemCreate, QuoteItemUpdate

VALID_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["sent", "accepted", "rejected", "expired"],
    "sent": ["accepted", "rejected", "expired"],
    "accepted": ["rejected"],  # can be cancelled if needed
    "rejected": [],
    "expired": [],
}


def _get_quote_or_404(db: Session, company_id: int, quote_id: int):
    quote = quote_repo.get_quote(db, company_id, quote_id)
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    return quote


def _validate_client(db: Session, company_id: int, client_id: int) -> None:
    if not client_repo.get_client_by_id(db, client_id, company_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )


def get_quotes(db: Session, company_id: int, client_id: int | None = None, quote_status: str | None = None, skip: int = 0, limit: int = 100):
    return quote_repo.get_quotes(db, company_id, client_id, quote_status, skip, limit)


def get_quote(db: Session, company_id: int, quote_id: int):
    return _get_quote_or_404(db, company_id, quote_id)


def create_quote(db: Session, company_id: int, data: QuoteCreate):
    if data.client_id is not None:
        _validate_client(db, company_id, data.client_id)
    return quote_repo.create_quote(
        db,
        company_id=company_id,
        client_id=data.client_id,
        title=data.title,
        valid_until=data.valid_until,
        notes=data.notes,
        tax_rate=data.tax_rate,
        discount=data.discount,
        equivalence_surcharge=data.equivalence_surcharge,
        retention=data.retention,
        terms=data.terms,
        shipping_address=data.shipping_address,
        custom_issuer_info=data.custom_issuer_info,
        custom_recipient_info=data.custom_recipient_info,
        signature_url=data.signature_url,
    )


def update_quote(db: Session, company_id: int, quote_id: int, data: QuoteUpdate):
    quote = _get_quote_or_404(db, company_id, quote_id)

    if "client_id" in data.model_fields_set and data.client_id is not None:
        _validate_client(db, company_id, data.client_id)

    # Validate status transition if status is being updated
    if data.status and data.status != quote.status:
        allowed = VALID_TRANSITIONS.get(quote.status, [])
        if data.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition quote from '{quote.status}' to '{data.status}'",
            )

    update_data = data.model_dump(exclude_unset=True)
    updated_quote = quote_repo.update_quote(db, quote, **update_data)
    quote_repo.recalculate_totals(db, updated_quote)
    return updated_quote


def delete_quote(db: Session, company_id: int, quote_id: int) -> None:
    quote = _get_quote_or_404(db, company_id, quote_id)
    if quote.status not in ("draft",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft quotes can be deleted",
        )
    quote_repo.delete_quote(db, quote)


# ---- Quote Items ----

def get_quote_items(db: Session, company_id: int, quote_id: int):
    _get_quote_or_404(db, company_id, quote_id)
    return quote_item_repo.get_quote_items(db, quote_id)


def create_quote_item(db: Session, company_id: int, quote_id: int, data: QuoteItemCreate):
    quote = _get_quote_or_404(db, company_id, quote_id)
    if quote.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add items to a non-draft quote",
        )
    item = quote_item_repo.create_quote_item(
        db,
        quote=quote,
        description=data.description,
        quantity=data.quantity,
        unit_price=data.unit_price,
    )
    # Recalculate totals after adding item
    quote_repo.recalculate_totals(db, quote)
    return item


def update_quote_item(db: Session, company_id: int, quote_id: int, item_id: int, data: QuoteItemUpdate):
    quote = _get_quote_or_404(db, company_id, quote_id)
    if quote.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit items of a non-draft quote",
        )
    # Find the item
    item = next((i for i in quote.items if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote item not found")
    update_data = data.model_dump(exclude_unset=True)
    item = quote_item_repo.update_quote_item(db, item, **update_data)
    quote_repo.recalculate_totals(db, quote)
    return item


def delete_quote_item(db: Session, company_id: int, quote_id: int, item_id: int) -> None:
    quote = _get_quote_or_404(db, company_id, quote_id)
    if quote.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete items from a non-draft quote",
        )
    item = next((i for i in quote.items if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote item not found")
    quote_item_repo.delete_quote_item(db, item)
    # refresh quote from db before recalculating since item is deleted
    db.refresh(quote)
    quote_repo.recalculate_totals(db, quote)
