"""Fiscal-record operations for issued invoices."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.fiscal_invoice_record import FiscalInvoiceRecord
from app.models.invoice import Invoice
from app.repositories import invoice as invoice_repo
from app.schemas.invoice import FiscalCancellationRequest
from app.services import fiscal_submission_service
from app.services.entitlement_service import require_company_feature
from app.services.invoice_fiscal import create_cancellation_record


def _get_invoice_or_404(db: Session, company_id: int, invoice_id: int) -> Invoice:
    require_company_feature(db, company_id=company_id, code="features.invoices")
    invoice = invoice_repo.get_invoice(db, company_id, invoice_id)
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    return invoice


def get_fiscal_record(
    db: Session, company_id: int, invoice_id: int
) -> FiscalInvoiceRecord:
    invoice = _get_invoice_or_404(db, company_id, invoice_id)
    record = (
        db.query(FiscalInvoiceRecord)
        .filter(FiscalInvoiceRecord.invoice_id == invoice.id)
        .order_by(FiscalInvoiceRecord.id.desc())
        .first()
    )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The invoice has not been issued and has no fiscal record",
        )
    return record


def submit_fiscal_record(
    db: Session,
    company_id: int,
    invoice_id: int,
) -> FiscalInvoiceRecord:
    _get_invoice_or_404(db, company_id, invoice_id)
    record = fiscal_submission_service.latest_invoice_record(
        db,
        company_id,
        invoice_id,
    )
    return fiscal_submission_service.submit_fiscal_record(
        db,
        company_id,
        record.id,
    )


def cancel_fiscal_invoice(
    db: Session,
    company_id: int,
    invoice_id: int,
    data: FiscalCancellationRequest,
) -> FiscalInvoiceRecord:
    require_company_feature(db, company_id=company_id, code="features.invoices")
    if not data.confirm_no_real_operation:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "Fiscal cancellation is only for an invoice issued without a "
                "real operation; use a rectifying invoice otherwise"
            ),
        )
    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == invoice_id,
            Invoice.company_id == company_id,
        )
        .with_for_update()
        .first()
    )
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    try:
        record = create_cancellation_record(
            db,
            invoice,
            reason=data.reason,
        )
        db.commit()
        db.refresh(record)
        if settings.VERIFACTU_AUTO_SUBMIT:
            record = fiscal_submission_service.submit_fiscal_record(
                db,
                company_id,
                record.id,
            )
        return record
    except Exception:
        db.rollback()
        raise
