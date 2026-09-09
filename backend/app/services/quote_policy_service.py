"""Shared authorization and editability rules for quotes and quote items."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import quote as quote_repo
from app.services.entitlement_service import require_company_feature


CONTENT_EDITABLE_STATUSES = frozenset({"draft"})
REVISIONABLE_STATUSES = frozenset({"sent", "rejected", "expired"})


def require_quotes_feature(db: Session, company_id: int) -> None:
    require_company_feature(db, company_id=company_id, code="features.quotes")


def assert_quote_content_editable(quote) -> None:
    if quote.status not in CONTENT_EDITABLE_STATUSES:
        detail = (
            "Accepted quotes are final and cannot be changed"
            if quote.status == "accepted"
            else "Create a new revision before changing a sent, rejected, or expired quote"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )


def assert_quote_revisionable(quote) -> None:
    if quote.status not in REVISIONABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only sent, rejected, or expired quotes can start a new revision",
        )


def get_quote_or_404(db: Session, company_id: int, quote_id: int):
    quote = quote_repo.get_quote(db, company_id, quote_id)
    if quote is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found",
        )
    return quote
