"""Customer receipt allocation and invoice collection-state rules."""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.customer_payment import CustomerPayment
from app.models.user import User
from app.repositories import customer_payment as customer_payment_repo
from app.repositories import client as client_repo
from app.schemas.customer_payment import CustomerPaymentCreate, CustomerPaymentVoid
from app.services.entitlement_service import require_company_feature


MONEY = Decimal("0.01")
PAYABLE_INVOICE_STATUSES = {"issued", "overdue", "partially_paid"}


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


def _company_id(current_user: User) -> int:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company context is required",
        )
    return current_user.company_id


def _require_feature(db: Session, company_id: int) -> None:
    require_company_feature(db, company_id=company_id, code="features.invoices")


def _payment_amount(payment: CustomerPayment) -> Decimal:
    return _money(Decimal(str(payment.amount)))


def _allocated_amount(payment: CustomerPayment) -> Decimal:
    return _money(sum((Decimal(str(item.amount)) for item in payment.allocations), Decimal("0")))


def _get_payment_or_404(
    db: Session, *, company_id: int, payment_id: int, for_update: bool = False
) -> CustomerPayment:
    payment = customer_payment_repo.get_payment(
        db,
        company_id=company_id,
        payment_id=payment_id,
        for_update=for_update,
    )
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cobro no encontrado")
    return payment


def _sync_invoice_collection_status(db: Session, invoice) -> None:
    allocated = _money(
        customer_payment_repo.allocated_amount_for_invoice(db, invoice_id=invoice.id)
    )
    total = _money(Decimal(str(invoice.total_amount)))
    if allocated >= total:
        invoice.status = "paid"
        invoice.paid_at = datetime.now(timezone.utc)
    elif allocated > 0:
        invoice.status = "partially_paid"
        invoice.paid_at = None
    else:
        due_date = invoice.due_date
        if due_date is not None and due_date.tzinfo is None:
            due_date = due_date.replace(tzinfo=timezone.utc)
        invoice.status = (
            "overdue"
            if due_date and due_date < datetime.now(timezone.utc)
            else "issued"
        )
        invoice.paid_at = None
    db.add(invoice)


def _response(payment: CustomerPayment) -> CustomerPayment:
    payment.allocated_amount = _allocated_amount(payment)
    payment.unapplied_amount = _money(_payment_amount(payment) - payment.allocated_amount)
    return payment


def list_payments(db: Session, current_user: User, *, client_id: int | None = None):
    company_id = _company_id(current_user)
    _require_feature(db, company_id)
    if client_id is not None and not client_repo.get_client_by_id(db, client_id, company_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    return [
        _response(payment)
        for payment in customer_payment_repo.list_payments(
            db, company_id=company_id, client_id=client_id
        )
    ]


def create_payment(
    db: Session,
    current_user: User,
    payload: CustomerPaymentCreate,
) -> CustomerPayment:
    company_id = _company_id(current_user)
    _require_feature(db, company_id)
    if not client_repo.get_client_by_id(db, payload.client_id, company_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")

    invoice_ids = [allocation.invoice_id for allocation in payload.allocations]
    invoices = customer_payment_repo.get_invoices_for_update(
        db, company_id=company_id, invoice_ids=invoice_ids
    )
    by_id = {invoice.id: invoice for invoice in invoices}
    if len(by_id) != len(invoice_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factura no encontrada")
    for allocation in payload.allocations:
        invoice = by_id[allocation.invoice_id]
        if invoice.client_id != payload.client_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Todas las facturas repartidas deben pertenecer al cliente del cobro",
            )
        if invoice.status not in PAYABLE_INVOICE_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Solo se pueden cobrar facturas emitidas, vencidas o parcialmente cobradas",
            )
        allocated = customer_payment_repo.allocated_amount_for_invoice(
            db, invoice_id=invoice.id
        )
        remaining = _money(Decimal(str(invoice.total_amount)) - allocated)
        if _money(allocation.amount) > remaining:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El reparto supera el saldo pendiente de la factura",
            )

    try:
        payment = customer_payment_repo.create_payment(
            db,
            company_id=company_id,
            client_id=payload.client_id,
            received_at=payload.received_at,
            amount=payload.amount,
            payment_method=payload.payment_method,
            reference=payload.reference,
            notes=payload.notes,
            status="received",
            created_by_user_id=current_user.id,
        )
        for allocation in payload.allocations:
            customer_payment_repo.create_allocation(
                db,
                payment_id=payment.id,
                invoice_id=allocation.invoice_id,
                amount=allocation.amount,
            )
        for invoice in invoices:
            _sync_invoice_collection_status(db, invoice)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo registrar el cobro por un conflicto de datos",
        ) from error
    except Exception:
        db.rollback()
        raise
    return _response(_get_payment_or_404(db, company_id=company_id, payment_id=payment.id))


def void_payment(
    db: Session,
    current_user: User,
    payment_id: int,
    payload: CustomerPaymentVoid,
) -> CustomerPayment:
    company_id = _company_id(current_user)
    _require_feature(db, company_id)
    payment = _get_payment_or_404(
        db, company_id=company_id, payment_id=payment_id, for_update=True
    )
    if payment.status != "received":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El cobro ya fue anulado",
        )
    invoices = customer_payment_repo.get_invoices_for_update(
        db,
        company_id=company_id,
        invoice_ids=[allocation.invoice_id for allocation in payment.allocations],
    )
    try:
        payment.status = "voided"
        payment.voided_at = datetime.now(timezone.utc)
        payment.voided_by_user_id = current_user.id
        payment.void_reason = payload.reason
        # Recompute balances from the persisted receipt state, not a stale
        # aggregate that may still see the receipt as received.
        db.flush()
        for invoice in invoices:
            _sync_invoice_collection_status(db, invoice)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return _response(_get_payment_or_404(db, company_id=company_id, payment_id=payment.id))
