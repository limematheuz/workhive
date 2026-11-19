from decimal import Decimal
from fastapi import HTTPException
from app.models.invoice import Invoice
from app.repositories import transaction_currency as repo,customer_payment as payments
from app.services import customer_payment_service as canonical
from app.services.currency_policy import converted,native_money,validate_amount
from app.services.estimator_cost_policy import money,ZERO


def settle(db,company,payment,spec,native,invoice=None):
    if spec.settle_invoice_id is None:return
    if invoice is None:invoice=repo.record(db,company,"invoices",spec.settle_invoice_id,lock=True)
    if invoice is None or invoice.client_id!=native.client_id:raise HTTPException(404,"Factura no encontrada para el cliente.")
    if invoice.total_amount<=0 or invoice.status not in canonical.PAYABLE_INVOICE_STATUSES:raise HTTPException(409,"La factura no tiene saldo cobrable.")
    applied=spec.settled_native_amount
    validate_amount(applied,spec.currency)
    if applied>native.amount:raise HTTPException(422,"El importe original aplicado supera el cobro.")
    snapshot=invoice.currency_snapshot or {};same=snapshot.get("currency")==spec.currency
    outstanding=money(Decimal(str(invoice.total_amount))-payments.allocated_amount_for_invoice(db,invoice_id=invoice.id))
    native_currency=None;native_amount=None
    if same:
        total=Decimal(snapshot["original_amounts"]["total_amount"]);eur_total=Decimal(str(invoice.total_amount))
        used=sum((Decimal(str(row.native_amount)) if row.native_currency==spec.currency and row.native_amount is not None else native_money(Decimal(str(row.amount))*total/eur_total,spec.currency) for row in repo.settlements(db,company,invoice.id)),ZERO)
        remaining=native_money(total-used,spec.currency)
        if applied>remaining:raise HTTPException(409,"El importe original aplicado supera el saldo de la factura en su moneda.")
        valuation=outstanding if applied==remaining else money(eur_total*applied/total)
        native_amount=applied;native_currency=spec.currency
    else:valuation=converted(applied,spec)
    if valuation>outstanding:raise HTTPException(409,"El reparto supera el saldo de la factura en EUR.")
    cash=converted(applied,spec);difference=money(cash-valuation)
    if cash<=0 or valuation<=0:raise HTTPException(422,"La aplicación del cobro debe representar al menos un céntimo EUR.")
    payments.create_allocation(db,payment_id=payment.id,invoice_id=invoice.id,amount=valuation,
        exchange_difference_eur=difference,native_amount=native_amount,native_currency=native_currency)
    db.flush();canonical._sync_invoice_collection_status(db,invoice)
