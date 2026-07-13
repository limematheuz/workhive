from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.quote import Quote


def _generate_quote_number(db: Session, company_id: int) -> str:
    year = datetime.now(timezone.utc).year
    count = (
        db.query(Quote)
        .filter(Quote.company_id == company_id)
        .count()
    )
    return f"QUO-{year}-{str(count + 1).zfill(4)}"


def get_quotes(
    db: Session,
    company_id: int,
    client_id: int | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Quote]:
    query = db.query(Quote).filter(
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
        .filter(
            Quote.id == quote_id,
            Quote.company_id == company_id,
            Quote.is_active.is_(True),
        )
        .first()
    )


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
    db.commit()
    db.refresh(quote)
    return quote


def update_quote(db: Session, quote: Quote, **kwargs) -> Quote:
    for key, value in kwargs.items():
        if value is not None:
            setattr(quote, key, value)
    db.commit()
    db.refresh(quote)
    return quote


def recalculate_totals(db: Session, quote: Quote) -> Quote:
    subtotal = sum(item.subtotal for item in quote.items)
    
    discount_pct = getattr(quote, "discount", 0.0) or 0.0
    discount_amount = subtotal * (discount_pct / 100.0)
    base_amount = subtotal - discount_amount
    
    tax_amount = 0.0
    for item in quote.items:
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

    db.commit()
    db.refresh(quote)
    return quote


def delete_quote(db: Session, quote: Quote) -> None:
    quote.is_active = False
    db.commit()
