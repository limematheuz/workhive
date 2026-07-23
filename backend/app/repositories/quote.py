from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session, selectinload

from app.models.quote import Quote
from app.models.quote_item import QuoteItem


def _lock_numbering(db: Session, company_id: int, year: int) -> None:
    if db.bind and db.bind.dialect.name == "postgresql":
        db.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
            {"lock_key": f"quote:{company_id}:{year}"},
        )


def _generate_quote_number(db: Session, company_id: int) -> str:
    year = datetime.now(timezone.utc).year
    _lock_numbering(db, company_id, year)
    prefix = f"QUO-{year}-"
    numbers = (
        db.query(Quote.quote_number)
        .filter(
            Quote.company_id == company_id,
            Quote.quote_number.like(f"{prefix}%"),
        )
        .all()
    )
    last_sequence = 0
    for (number,) in numbers:
        try:
            last_sequence = max(last_sequence, int(number.removeprefix(prefix)))
        except ValueError:
            continue
    return f"{prefix}{last_sequence + 1:04d}"


def get_quotes(
    db: Session,
    company_id: int,
    client_id: int | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Quote]:
    query = db.query(Quote).options(selectinload(Quote.items)).filter(
        Quote.company_id == company_id,
        Quote.is_active.is_(True),
    )
    if client_id:
        query = query.filter(Quote.client_id == client_id)
    if status:
        query = query.filter(Quote.status == status)
    return query.order_by(Quote.created_at.desc()).offset(skip).limit(limit).all()


def get_quote(db: Session, company_id: int, quote_id: int) -> Quote | None:
    return (
        db.query(Quote)
        .options(selectinload(Quote.items))
        .filter(
            Quote.id == quote_id,
            Quote.company_id == company_id,
            Quote.is_active.is_(True),
        )
        .first()
    )


def get_quote_for_update(
    db: Session,
    company_id: int,
    quote_id: int,
) -> Quote | None:
    query = (
        db.query(Quote)
        .options(selectinload(Quote.items))
        .filter(
            Quote.id == quote_id,
            Quote.company_id == company_id,
            Quote.is_active.is_(True),
        )
    )
    if db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.first()


def create_quote(
    db: Session,
    company_id: int,
    client_id: int | None,
    title: str,
    valid_until=None,
    notes: str | None = None,
    tax_rate: float = 0.21,
    discount: float = 0.0,
    equivalence_surcharge: float = 0.0,
    retention: float = 0.0,
    terms: str | None = None,
    shipping_address: str | None = None,
    custom_issuer_info: str | None = None,
    custom_recipient_info: str | None = None,
    signature_url: str | None = None,
) -> Quote:
    quote_number = _generate_quote_number(db, company_id)
    quote = Quote(
        company_id=company_id,
        client_id=client_id,
        quote_number=quote_number,
        title=title,
        valid_until=valid_until,
        notes=notes,
        tax_rate=tax_rate,
        status="draft",
        base_amount=0.0,
        tax_amount=0.0,
        total_amount=0.0,
        discount=discount,
        equivalence_surcharge=equivalence_surcharge,
        retention=retention,
        terms=terms,
        shipping_address=shipping_address,
        custom_issuer_info=custom_issuer_info,
        custom_recipient_info=custom_recipient_info,
        signature_url=signature_url,
    )
    db.add(quote)
    db.flush()
    return quote


def update_quote(db: Session, quote: Quote, **kwargs) -> Quote:
    for key, value in kwargs.items():
        setattr(quote, key, value)
    db.add(quote)
    db.flush()
    return quote


def recalculate_totals(db: Session, quote: Quote) -> Quote:
    # Query the current transaction snapshot. Relationship collections may be
    # stale after adding or deleting rows through the compatibility endpoints.
    items = (
        db.query(QuoteItem)
        .filter(QuoteItem.quote_id == quote.id)
        .order_by(QuoteItem.id.asc())
        .all()
    )
    subtotal = sum(item.subtotal for item in items)
    
    discount_pct = getattr(quote, "discount", 0.0) or 0.0
    discount_amount = subtotal * (discount_pct / 100.0)
    base_amount = subtotal - discount_amount
    
    tax_amount = 0.0
    for item in items:
        item_subtotal_discounted = item.subtotal * (1.0 - discount_pct / 100.0)
        item_tax = item_subtotal_discounted * quote.tax_rate
        tax_amount += item_tax
        
    surcharge_pct = getattr(quote, "equivalence_surcharge", 0.0) or 0.0
    surcharge_amount = base_amount * (surcharge_pct / 100.0)
    
    retention_pct = getattr(quote, "retention", 0.0) or 0.0
    retention_amount = base_amount * (retention_pct / 100.0)
    
    quote.base_amount = round(base_amount, 2)
    quote.tax_amount = round(tax_amount + surcharge_amount, 2)
    quote.total_amount = round(base_amount + tax_amount + surcharge_amount - retention_amount, 2)

    db.add(quote)
    db.flush()
    return quote


def delete_quote(db: Session, quote: Quote) -> None:
    quote.is_active = False
    db.add(quote)
    db.flush()
