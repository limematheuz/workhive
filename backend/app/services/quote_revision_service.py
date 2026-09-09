"""Immutable revision history for commercial quotes."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import quote as quote_repo
from app.repositories import quote_revision as quote_revision_repo
from app.schemas.quote import QuoteRevisionCreate
from app.services.quote_policy_service import (
    assert_quote_revisionable,
    get_quote_or_404,
    require_quotes_feature,
)


def _as_snapshot_datetime(value) -> str | None:
    return value.isoformat() if value is not None else None


def _build_quote_snapshot(quote) -> dict:
    """Capture every commercial field and line before a version is sent."""
    return {
        "quote_number": quote.quote_number,
        "title": quote.title,
        "client_id": quote.client_id,
        "valid_until": _as_snapshot_datetime(quote.valid_until),
        "notes": quote.notes,
        "tax_rate": quote.tax_rate,
        "discount": quote.discount,
        "equivalence_surcharge": quote.equivalence_surcharge,
        "retention": quote.retention,
        "terms": quote.terms,
        "shipping_address": quote.shipping_address,
        "custom_issuer_info": quote.custom_issuer_info,
        "custom_recipient_info": quote.custom_recipient_info,
        "signature_url": quote.signature_url,
        "base_amount": quote.base_amount,
        "tax_amount": quote.tax_amount,
        "total_amount": quote.total_amount,
        "items": [
            {
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "subtotal": item.subtotal,
            }
            for item in quote.items
        ],
    }


def get_or_create_current_quote_revision(
    db: Session,
    quote,
    *,
    actor_user_id: int | None,
):
    existing = quote_revision_repo.get_revision_for_quote(
        db,
        quote,
        quote.revision_number,
    )
    if existing is not None:
        return existing
    return quote_revision_repo.create_quote_revision(
        db,
        quote=quote,
        snapshot=_build_quote_snapshot(quote),
        created_by_user_id=actor_user_id,
    )


def get_quote_revisions(db: Session, company_id: int, quote_id: int):
    require_quotes_feature(db, company_id)
    get_quote_or_404(db, company_id, quote_id)
    return quote_revision_repo.get_quote_revisions(db, company_id, quote_id)


def create_quote_revision(
    db: Session,
    company_id: int,
    quote_id: int,
    data: QuoteRevisionCreate,
    *,
    actor_user_id: int | None = None,
):
    del data  # Reserved for a future required customer-change note.
    require_quotes_feature(db, company_id)
    quote = quote_repo.get_quote_for_update(db, company_id, quote_id)
    if quote is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found",
        )
    assert_quote_revisionable(quote)

    try:
        get_or_create_current_quote_revision(
            db,
            quote,
            actor_user_id=actor_user_id,
        )
        quote.revision_number += 1
        quote.status = "draft"
        quote.accepted_revision_id = None
        db.add(quote)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return quote_repo.get_quote(db, company_id, quote_id)
