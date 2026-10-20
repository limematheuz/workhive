"""Persistence access for customer receipts without business decisions."""

from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models.customer_payment import CustomerPayment, CustomerPaymentAllocation
from app.models.invoice import Invoice


def _with_details(query):
    return query.options(selectinload(CustomerPayment.allocations))


def list_payments(
    db: Session,
    *,
    company_id: int,
    client_id: int | None = None,
) -> list[CustomerPayment]:
    query = _with_details(
        db.query(CustomerPayment).filter(CustomerPayment.company_id == company_id)
    )
    if client_id is not None:
        query = query.filter(CustomerPayment.client_id == client_id)
    return query.order_by(CustomerPayment.received_at.desc(), CustomerPayment.id.desc()).all()


def get_payment(
    db: Session,
    *,
    company_id: int,
    payment_id: int,
    for_update: bool = False,
) -> CustomerPayment | None:
    query = _with_details(
        db.query(CustomerPayment).filter(
            CustomerPayment.company_id == company_id,
            CustomerPayment.id == payment_id,
        )
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.one_or_none()


def get_invoices_for_update(
    db: Session,
    *,
    company_id: int,
    invoice_ids: list[int],
) -> list[Invoice]:
    if not invoice_ids:
        return []
    query = db.query(Invoice).filter(
        Invoice.company_id == company_id,
        Invoice.id.in_(sorted(set(invoice_ids))),
    )
    if db.bind and db.bind.dialect.name == "postgresql":
        query = query.with_for_update()
    return query.order_by(Invoice.id).all()


def allocated_amount_for_invoice(db: Session, *, invoice_id: int) -> Decimal:
    amount = (
        db.query(func.coalesce(func.sum(CustomerPaymentAllocation.amount), 0))
        .join(CustomerPayment, CustomerPayment.id == CustomerPaymentAllocation.payment_id)
        .filter(
            CustomerPaymentAllocation.invoice_id == invoice_id,
            CustomerPayment.status == "received",
        )
        .scalar()
    )
    return Decimal(str(amount or 0))


def allocated_amounts_for_invoices(
    db: Session, *, company_id: int, invoice_ids: list[int]
) -> dict[int, Decimal]:
    if not invoice_ids:
        return {}
    rows = (
        db.query(
            CustomerPaymentAllocation.invoice_id,
            func.sum(CustomerPaymentAllocation.amount),
        )
        .join(CustomerPayment, CustomerPayment.id == CustomerPaymentAllocation.payment_id)
        .join(Invoice, Invoice.id == CustomerPaymentAllocation.invoice_id)
        .filter(
            Invoice.company_id == company_id,
            CustomerPayment.company_id == company_id,
            CustomerPayment.status == "received",
            CustomerPaymentAllocation.invoice_id.in_(sorted(set(invoice_ids))),
        )
        .group_by(CustomerPaymentAllocation.invoice_id)
        .all()
    )
    return {invoice_id: Decimal(str(amount)) for invoice_id, amount in rows}


def create_payment(db: Session, **values) -> CustomerPayment:
    payment = CustomerPayment(**values)
    db.add(payment)
    db.flush()
    return payment


def create_allocation(db: Session, **values) -> CustomerPaymentAllocation:
    allocation = CustomerPaymentAllocation(**values)
    db.add(allocation)
    db.flush()
    return allocation
