from sqlalchemy.orm import Session
from app.models.quote_item import QuoteItem
from app.models.quote import Quote


def get_quote_items(db: Session, quote_id: int) -> list[QuoteItem]:
    return db.query(QuoteItem).filter(QuoteItem.quote_id == quote_id).all()


def create_quote_item(
    db: Session,
    quote: Quote,
    description: str,
    quantity: float,
    unit_price: float,
) -> QuoteItem:
    subtotal = round(quantity * unit_price, 2)
    item = QuoteItem(
        quote_id=quote.id,
        description=description,
        quantity=quantity,
        unit_price=unit_price,
        subtotal=subtotal,
    )
    db.add(item)
    db.flush()
    return item


def update_quote_item(db: Session, item: QuoteItem, **kwargs) -> QuoteItem:
    if "quantity" in kwargs or "unit_price" in kwargs:
        qty = kwargs.get("quantity", item.quantity)
        price = kwargs.get("unit_price", item.unit_price)
        kwargs["subtotal"] = round(qty * price, 2)
    for key, value in kwargs.items():
        setattr(item, key, value)
    db.add(item)
    db.flush()
    return item


def delete_quote_item(db: Session, item: QuoteItem) -> None:
    db.delete(item)
    db.flush()
