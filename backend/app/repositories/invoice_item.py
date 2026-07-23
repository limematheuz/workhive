from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.schemas.invoice_item import InvoiceItemBase, InvoiceItemUpdate


MONEY_QUANTUM = Decimal("0.01")
DETAIL_QUANTUM = Decimal("0.0001")


def decimal_value(value: object) -> Decimal:
    return Decimal(str(value or 0))


def round_money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def calculate_item_amounts(
    quantity: object, unit_price: object, tax_rate: object
) -> tuple[Decimal, Decimal]:
    subtotal = round_money(decimal_value(quantity) * decimal_value(unit_price))
    total = round_money(subtotal + subtotal * decimal_value(tax_rate))
    return subtotal, total


def recalculate_invoice_totals(db: Session, invoice: Invoice) -> None:
    items = get_invoice_items(db, invoice.id)
    subtotal = sum((decimal_value(item.subtotal) for item in items), Decimal(0))
    discount_rate = decimal_value(invoice.discount) / Decimal(100)
    base_amount = round_money(subtotal * (Decimal(1) - discount_rate))

    tax_amount = Decimal(0)
    for item in items:
        discounted_subtotal = decimal_value(item.subtotal) * (
            Decimal(1) - discount_rate
        )
        tax_amount += discounted_subtotal * decimal_value(item.tax_rate)
    tax_amount = round_money(tax_amount)

    surcharge_amount = round_money(
        base_amount * decimal_value(invoice.equivalence_surcharge) / Decimal(100)
    )
    retention_amount = round_money(
        base_amount * decimal_value(invoice.retention) / Decimal(100)
    )

    invoice.base_amount = base_amount
    invoice.tax_amount = tax_amount + surcharge_amount
    invoice.total_amount = round_money(
        base_amount + tax_amount + surcharge_amount - retention_amount
    )
    db.add(invoice)
    db.flush()


def create_invoice_item(
    db: Session, invoice_id: int, item_data: InvoiceItemBase
) -> InvoiceItem:
    subtotal, total = calculate_item_amounts(
        item_data.quantity, item_data.unit_price, item_data.tax_rate
    )
    item = InvoiceItem(
        **item_data.model_dump(),
        invoice_id=invoice_id,
        subtotal=subtotal,
        total=total,
    )
    db.add(item)
    db.flush()
    return item


def get_invoice_items(db: Session, invoice_id: int) -> list[InvoiceItem]:
    return db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice_id).all()


def get_invoice_item(db: Session, item_id: int) -> InvoiceItem | None:
    return db.query(InvoiceItem).filter(InvoiceItem.id == item_id).first()


def update_invoice_item(
    db: Session, item: InvoiceItem, item_data: InvoiceItemUpdate
) -> InvoiceItem:
    for key, value in item_data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    item.subtotal, item.total = calculate_item_amounts(
        item.quantity, item.unit_price, item.tax_rate
    )
    db.add(item)
    db.flush()
    return item


def delete_invoice_item(db: Session, item: InvoiceItem) -> None:
    db.delete(item)
    db.flush()
