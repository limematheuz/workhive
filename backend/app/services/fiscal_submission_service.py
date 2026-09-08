from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.integrations.aeat.client import submit_record
from app.models.fiscal_invoice_record import FiscalInvoiceRecord
from app.models.invoice import Invoice
from app.services import company_fiscal_settings_service


FINAL_STATUSES = {"accepted", "accepted_with_errors"}


def _record(
    db: Session,
    company_id: int,
    record_id: int,
) -> FiscalInvoiceRecord:
    record = (
        db.query(FiscalInvoiceRecord)
        .filter(
            FiscalInvoiceRecord.id == record_id,
            FiscalInvoiceRecord.company_id == company_id,
        )
        .with_for_update()
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Fiscal record not found")
    return record


def submit_fiscal_record(
    db: Session,
    company_id: int,
    record_id: int,
) -> FiscalInvoiceRecord:
    record = _record(db, company_id, record_id)
    if record.submission_status in FINAL_STATUSES:
        return record
    if not record.request_xml:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The fiscal record has no validated AEAT XML",
        )

    attempted_at = datetime.now(timezone.utc)
    record.attempt_count += 1
    record.last_attempt_at = attempted_at
    record.next_retry_at = None
    record.submission_status = "submitting"
    db.add(record)
    db.commit()

    try:
        with company_fiscal_settings_service.submission_credentials(
            db,
            company_id,
        ) as (certificate_path, certificate_password, environment):
            result = submit_record(
                record.request_xml,
                certificate_path=certificate_path,
                certificate_password=certificate_password,
                environment=environment,
            )
    except (httpx.HTTPError, OSError, ValueError) as exc:
        record = _record(db, company_id, record_id)
        record.error_message = str(exc)[:2000]
        if record.attempt_count >= settings.VERIFACTU_MAX_RETRIES:
            record.submission_status = "retry_exhausted"
            record.next_retry_at = None
        else:
            delay_minutes = min(2 ** max(record.attempt_count - 1, 0), 24 * 60)
            record.submission_status = "retry_pending"
            record.next_retry_at = attempted_at + timedelta(minutes=delay_minutes)
        record.invoice.fiscal_submission_status = record.submission_status
        db.add(record.invoice)
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    record = _record(db, company_id, record_id)
    record.submission_status = result.status
    record.aeat_csv = result.csv
    record.aeat_response = result.response_data
    record.response_xml = result.response_xml
    record.error_message = result.error_message
    record.submitted_at = attempted_at
    record.next_retry_at = None
    invoice = record.invoice
    invoice.fiscal_submission_status = result.status
    if result.csv:
        invoice.aeat_csv = result.csv
    db.add(record)
    db.add(invoice)
    db.commit()
    db.refresh(record)
    return record


def retry_due_records(db: Session, *, limit: int = 100) -> list[int]:
    now = datetime.now(timezone.utc)
    ids = [
        record_id
        for (record_id,) in (
            db.query(FiscalInvoiceRecord.id)
            .filter(
                FiscalInvoiceRecord.submission_status == "retry_pending",
                FiscalInvoiceRecord.next_retry_at <= now,
            )
            .order_by(FiscalInvoiceRecord.next_retry_at.asc())
            .limit(limit)
            .all()
        )
    ]
    processed = []
    for record_id in ids:
        record = db.query(FiscalInvoiceRecord).filter(
            FiscalInvoiceRecord.id == record_id
        ).one()
        submit_fiscal_record(db, record.company_id, record.id)
        processed.append(record.id)
    return processed


def latest_invoice_record(
    db: Session,
    company_id: int,
    invoice_id: int,
) -> FiscalInvoiceRecord:
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.company_id == company_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    record = (
        db.query(FiscalInvoiceRecord)
        .filter(FiscalInvoiceRecord.invoice_id == invoice.id)
        .order_by(FiscalInvoiceRecord.id.desc())
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Fiscal record not found")
    return record
