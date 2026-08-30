"""Quote item operations kept separate from the quote lifecycle service."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import quote as quote_repo
from app.repositories import quote_item as quote_item_repo
from app.schemas.quote_item import QuoteItemCreate, QuoteItemUpdate
from app.services.quote_policy_service import (
    assert_quote_content_editable,
    get_quote_or_404,
    require_quotes_feature,
)


def get_quote_items(db: Session, company_id: int, quote_id: int):
    require_quotes_feature(db, company_id)
    get_quote_or_404(db, company_id, quote_id)
    return quote_item_repo.get_quote_items(db, quote_id)


def create_quote_item(
    db: Session, company_id: int, quote_id: int, data: QuoteItemCreate
):
    require_quotes_feature(db, company_id)
    quote = get_quote_or_404(db, company_id, quote_id)
    assert_quote_content_editable(quote)
    try:
        item = quote_item_repo.create_quote_item(
            db,
            quote=quote,
            description=data.description,
            quantity=data.quantity,
            unit_price=data.unit_price,
        )
        quote_repo.recalculate_totals(db, quote)
        db.commit()
        db.refresh(item)
        return item
    except Exception:
        db.rollback()
        raise


def update_quote_item(
    db: Session, company_id: int, quote_id: int, item_id: int, data: QuoteItemUpdate
):
    require_quotes_feature(db, company_id)
    quote = get_quote_or_404(db, company_id, quote_id)
    assert_quote_content_editable(quote)
    item = next((item for item in quote.items if item.id == item_id), None)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote item not found",
        )
    update_data = data.model_dump(exclude_unset=True)
    try:
        item = quote_item_repo.update_quote_item(db, item, **update_data)
        quote_repo.recalculate_totals(db, quote)
        db.commit()
        db.refresh(item)
        return item
    except Exception:
        db.rollback()
        raise


def delete_quote_item(
    db: Session, company_id: int, quote_id: int, item_id: int
) -> None:
    require_quotes_feature(db, company_id)
    quote = get_quote_or_404(db, company_id, quote_id)
    assert_quote_content_editable(quote)
    item = next((item for item in quote.items if item.id == item_id), None)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote item not found",
        )
    try:
        quote_item_repo.delete_quote_item(db, item)
        db.expire(quote, ["items"])
        quote_repo.recalculate_totals(db, quote)
        db.commit()
    except Exception:
        db.rollback()
        raise
