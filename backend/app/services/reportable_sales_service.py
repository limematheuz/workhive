"""Shared reporting rules for WorkHive invoices and imported historical sales."""

from collections.abc import Iterable

from app.models.invoice import Invoice
from app.models.sales_ledger_record import SalesLedgerRecord


REPORTABLE_INVOICE_STATUSES = ("issued", "paid", "overdue", "rectified")


def _normalized_document_number(value: str) -> str:
    return value.strip().casefold()


def manual_records_without_workhive_invoice(
    invoices: Iterable[Invoice],
    manual_records: Iterable[SalesLedgerRecord],
) -> list[SalesLedgerRecord]:
    """Keep historical records only when a real WorkHive invoice does not exist.

    New manual records already reject an equal document number. This defensive
    guard also protects fiscal reports from legacy imports made before that
    constraint existed. The real invoice is always the authoritative source.
    """
    invoice_numbers = {
        _normalized_document_number(invoice.invoice_number)
        for invoice in invoices
        if invoice.invoice_number
    }
    return [
        record
        for record in manual_records
        if _normalized_document_number(record.document_number) not in invoice_numbers
    ]
