from sqlalchemy.orm import Session

from app.models.quote import Quote
from app.models.quote_revision import QuoteRevision


def get_quote_revisions(
    db: Session,
    company_id: int,
    quote_id: int,
) -> list[QuoteRevision]:
    return (
        db.query(QuoteRevision)
        .filter(
            QuoteRevision.company_id == company_id,
            QuoteRevision.quote_id == quote_id,
        )
        .order_by(QuoteRevision.version.desc())
        .all()
    )


def get_revision_for_quote(
    db: Session,
    quote: Quote,
    version: int,
) -> QuoteRevision | None:
    return (
        db.query(QuoteRevision)
        .filter(
            QuoteRevision.company_id == quote.company_id,
            QuoteRevision.quote_id == quote.id,
            QuoteRevision.version == version,
        )
        .one_or_none()
    )


def get_quote_revision(
    db: Session,
    company_id: int,
    revision_id: int,
) -> QuoteRevision | None:
    return (
        db.query(QuoteRevision)
        .filter(
            QuoteRevision.id == revision_id,
            QuoteRevision.company_id == company_id,
        )
        .one_or_none()
    )


def create_quote_revision(
    db: Session,
    *,
    quote: Quote,
    snapshot: dict,
    created_by_user_id: int | None,
) -> QuoteRevision:
    revision = QuoteRevision(
        quote_id=quote.id,
        company_id=quote.company_id,
        created_by_user_id=created_by_user_id,
        version=quote.revision_number,
        snapshot=snapshot,
    )
    db.add(revision)
    db.flush()
    return revision
