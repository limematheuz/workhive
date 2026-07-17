import re
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.integrations.aeat.hash import (
    CancellationHashInput,
    InvoiceHashInput,
    calculate_cancellation_hash,
    calculate_invoice_hash,
)
from app.integrations.aeat.verifactu import get_verifactu_readiness
from app.integrations.aeat.xml import (
    build_cancellation_xml,
    build_qr_url,
    build_registration_xml,
)
from app.models.client import Client
from app.models.company import Company
from app.models.fiscal_invoice_record import FiscalInvoiceRecord
from app.models.invoice import Invoice
from app.repositories import invoice as invoice_repo


MONEY = Decimal("0.01")
PARTY_FIELD_LABELS = {
    "NIF/CIF:": "tax_id",
    "Dirección:": "address",
    "Teléfono:": "phone",
    "Email:": "email",
    "Banco:": "bank_account",
}
TAX_ID_SEPARATOR_RE = re.compile(r"[\s.\-/]+")
SPANISH_TAX_ID_RE = re.compile(
    r"^(?:[0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J])$"
)
MISSING_TAX_ID_VALUES = {
    "",
    "-",
    "NA",
    "N/A",
    "NOINFORMADO",
    "SINDNI",
    "SINNIF",
    "SINCIF",
    "PARTICULAR",
}


def _normalize_tax_id(value: object | None) -> str:
    normalized = TAX_ID_SEPARATOR_RE.sub("", str(value or "")).upper()
    if normalized.startswith("ES") and len(normalized) == 11:
        return normalized[2:]
    return normalized


def _valid_nif(value: object | None) -> bool:
    return bool(SPANISH_TAX_ID_RE.match(_normalize_tax_id(value)))


def _has_tax_id(value: object | None) -> bool:
    return _normalize_tax_id(value) not in MISSING_TAX_ID_VALUES


def _money(value: object) -> str:
    return f"{Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP):f}"


def _rate(value: object) -> str:
    normalized = Decimal(str(value or 0)).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )
    return f"{normalized:f}".rstrip("0").rstrip(".") or "0"


def _date(value: datetime) -> str:
    return value.strftime("%d-%m-%Y")


def _custom_party_fields(display_text: str | None) -> dict[str, str]:
    if not display_text:
        return {}
    lines = [line.strip() for line in display_text.splitlines()]
    fields: dict[str, str] = {}
    if lines and lines[0]:
        fields["name"] = lines[0]
    for line in lines[1:]:
        for label, field in PARTY_FIELD_LABELS.items():
            if line.startswith(label):
                value = line[len(label):].strip()
                if value:
                    fields[field] = value
                break
    return fields


def party_snapshots(
    company: Company,
    client: Client,
    invoice: Invoice,
) -> tuple[dict, dict]:
    issuer = {
        "name": company.name,
        "tax_id": company.tax_id,
        "address": company.address,
        "phone": company.phone,
        "email": company.email,
        "bank_account": company.bank_account,
        "logo": company.logo,
        "display_text": invoice.custom_issuer_info,
    }
    recipient = {
        "name": client.name,
        "tax_id": client.legal_number,
        "address": client.address,
        "postal_code": client.postal_code,
        "city": client.city,
        "country": client.country,
        "phone": client.phone,
        "email": client.email,
        "display_text": invoice.custom_recipient_info,
    }
    issuer.update(_custom_party_fields(invoice.custom_issuer_info))
    recipient.update(_custom_party_fields(invoice.custom_recipient_info))
    issuer["tax_id"] = _normalize_tax_id(issuer.get("tax_id"))
    recipient["tax_id"] = _normalize_tax_id(recipient.get("tax_id"))
    return issuer, recipient


def validate_issuance(
    issuer: dict,
    recipient: dict,
    invoice: Invoice,
) -> None:
    missing: list[str] = []
    invalid: list[str] = []
    if not issuer.get("name"):
        missing.append("issuer name")
    if not issuer.get("tax_id"):
        missing.append("issuer tax ID")
    elif not _valid_nif(issuer.get("tax_id")):
        invalid.append("issuer tax ID")
    if not issuer.get("address"):
        missing.append("issuer address")
    if not recipient.get("name"):
        missing.append("recipient name")
    if _has_tax_id(recipient.get("tax_id")) and not _valid_nif(recipient.get("tax_id")):
        invalid.append("recipient tax ID")
    if not recipient.get("address"):
        missing.append("recipient address")
    if not invoice.items:
        missing.append("at least one invoice line")
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Cannot issue invoice. Missing: {', '.join(missing)}",
        )
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Cannot issue invoice. Invalid: {', '.join(invalid)}",
        )


def _tax_breakdown(invoice: Invoice) -> list[dict]:
    discount_rate = Decimal(str(invoice.discount or 0)) / Decimal("100")
    groups: dict[Decimal, Decimal] = defaultdict(Decimal)
    for item in invoice.items:
        rate = Decimal(str(item.tax_rate or 0))
        groups[rate] += Decimal(str(item.subtotal or 0)) * (
            Decimal("1") - discount_rate
        )

    surcharge_rate = Decimal(str(invoice.equivalence_surcharge or 0))
    result = []
    for tax_rate, raw_base in sorted(groups.items()):
        base = raw_base.quantize(MONEY, rounding=ROUND_HALF_UP)
        tax = (base * tax_rate).quantize(MONEY, rounding=ROUND_HALF_UP)
        surcharge = (
            base * surcharge_rate / Decimal("100")
        ).quantize(MONEY, rounding=ROUND_HALF_UP)
        result.append(
            {
                "rate": _rate(tax_rate * Decimal("100")),
                "base": _money(base),
                "tax": _money(tax),
                "surcharge_rate": (
                    _rate(surcharge_rate) if surcharge_rate else None
                ),
                "surcharge_amount": (
                    _money(surcharge) if surcharge_rate else None
                ),
            }
        )
    return result


def _software_identity(company: Company) -> dict:
    readiness = get_verifactu_readiness()
    producer_tax_id = _normalize_tax_id(
        settings.VERIFACTU_SOFTWARE_PRODUCER_TAX_ID or company.tax_id
    )
    if not _valid_nif(producer_tax_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Cannot issue invoice. Invalid: software producer tax ID",
        )
    return {
        "producer_name": (
            settings.VERIFACTU_SOFTWARE_PRODUCER_NAME or company.name
        ),
        "producer_tax_id": producer_tax_id,
        "software_name": settings.PROJECT_NAME,
        "software_id": settings.VERIFACTU_SOFTWARE_ID,
        "software_version": settings.APP_VERSION,
        "installation_id": (
            f"{settings.VERIFACTU_INSTALLATION_ID}-{company.id}"
        ),
        "test_identity_fallback": not readiness.producer_configured,
    }


def _previous_record_data(
    previous: FiscalInvoiceRecord | None,
) -> dict | None:
    if previous is None:
        return None
    official = (previous.payload or {}).get("official") or {}
    invoice = previous.invoice
    return {
        "issuer_tax_id": (
            official.get("issuer_tax_id")
            or (invoice.issuer_snapshot or {}).get("tax_id")
        ),
        "invoice_number": (
            official.get("invoice_number") or invoice.invoice_number
        ),
        "issue_date": (
            official.get("issue_date") or _date(invoice.issue_date)
        ),
        "record_hash": previous.record_hash,
    }


def _base_official_data(
    invoice: Invoice,
    company: Company,
    issuer_snapshot: dict,
    recipient_snapshot: dict,
    generated_at: datetime,
    previous: FiscalInvoiceRecord | None,
) -> dict:
    description = "; ".join(
        item.description.strip() for item in invoice.items if item.description
    )
    recipient_tax_id = (
        recipient_snapshot["tax_id"]
        if _has_tax_id(recipient_snapshot.get("tax_id"))
        else None
    )
    invoice_type = "R1" if invoice.is_rectification else ("F1" if recipient_tax_id else "F2")
    return {
        "issuer_name": issuer_snapshot["name"],
        "issuer_tax_id": issuer_snapshot["tax_id"],
        "recipient_name": recipient_snapshot["name"],
        "recipient_tax_id": recipient_tax_id,
        "invoice_number": invoice.invoice_number,
        "issue_date": _date(invoice.issue_date),
        "invoice_type": invoice_type,
        "description": description or "Prestación de servicios",
        "tax_amount": _money(invoice.tax_amount),
        "total_amount": _money(invoice.total_amount),
        "tax_breakdown": _tax_breakdown(invoice),
        "generated_at": generated_at.isoformat(timespec="seconds"),
        "previous_record": _previous_record_data(previous),
        "external_reference": f"workhive-invoice-{invoice.id}",
        **_software_identity(company),
    }


def fiscal_payload(
    invoice: Invoice,
    official: dict,
    issuer_snapshot: dict,
    recipient_snapshot: dict,
) -> dict:
    return {
        "schema_version": "AEAT-SIF-1.0",
        "record_type": "alta",
        "official": official,
        "invoice": {
            "number": invoice.invoice_number,
            "issue_date": invoice.issue_date.date().isoformat(),
            "invoice_type": official["invoice_type"],
            "issuer_tax_id": official["issuer_tax_id"],
            "recipient_tax_id": official.get("recipient_tax_id"),
            "base_amount": str(invoice.base_amount),
            "tax_amount": str(invoice.tax_amount),
            "total_amount": str(invoice.total_amount),
            "original_invoice_id": invoice.original_invoice_id,
            "rectification_reason": invoice.rectification_reason,
            "issuer_snapshot": issuer_snapshot,
            "recipient_snapshot": recipient_snapshot,
            "lines": [
                {
                    "description": item.description,
                    "quantity": str(item.quantity),
                    "unit_price": str(item.unit_price),
                    "tax_rate": str(item.tax_rate),
                    "subtotal": str(item.subtotal),
                    "total": str(item.total),
                }
                for item in invoice.items
            ],
        },
    }


def _latest_record(
    db: Session,
    company_id: int,
) -> FiscalInvoiceRecord | None:
    return (
        db.query(FiscalInvoiceRecord)
        .filter(FiscalInvoiceRecord.company_id == company_id)
        .order_by(FiscalInvoiceRecord.id.desc())
        .with_for_update()
        .first()
    )


def create_fiscal_record(
    db: Session,
    invoice: Invoice,
    company: Company,
    issuer_snapshot: dict,
    recipient_snapshot: dict,
    generated_at: datetime,
) -> FiscalInvoiceRecord:
    previous = _latest_record(db, invoice.company_id)
    official = _base_official_data(
        invoice,
        company,
        issuer_snapshot,
        recipient_snapshot,
        generated_at,
        previous,
    )
    if invoice.original_invoice_id:
        original = (
            db.query(Invoice)
            .filter(
                Invoice.id == invoice.original_invoice_id,
                Invoice.company_id == invoice.company_id,
            )
            .one()
        )
        official["rectified_invoice"] = {
            "issuer_tax_id": issuer_snapshot["tax_id"],
            "invoice_number": original.invoice_number,
            "issue_date": _date(original.issue_date),
        }

    official["record_hash"] = calculate_invoice_hash(
        InvoiceHashInput(
            issuer_tax_id=official["issuer_tax_id"],
            invoice_number=official["invoice_number"],
            issue_date=official["issue_date"],
            invoice_type=official["invoice_type"],
            tax_amount=official["tax_amount"],
            total_amount=official["total_amount"],
            previous_hash=previous.record_hash if previous else None,
            generated_at=official["generated_at"],
        )
    )
    request_xml = build_registration_xml(official)
    readiness = get_verifactu_readiness()
    submission_status = (
        "pending_submission"
        if readiness.submission_available
        else "not_configured"
    )
    payload = fiscal_payload(
        invoice,
        official,
        issuer_snapshot,
        recipient_snapshot,
    )
    record = FiscalInvoiceRecord(
        invoice_id=invoice.id,
        company_id=invoice.company_id,
        record_type="alta",
        payload=payload,
        request_xml=request_xml,
        previous_hash=previous.record_hash if previous else None,
        record_hash=official["record_hash"],
        submission_status=submission_status,
    )
    db.add(record)
    invoice.invoice_hash = record.record_hash
    invoice.previous_invoice_hash = record.previous_hash
    invoice.fiscal_submission_status = submission_status
    invoice.qr_url = build_qr_url(
        issuer_tax_id=official["issuer_tax_id"],
        invoice_number=official["invoice_number"],
        issue_date=official["issue_date"],
        total_amount=official["total_amount"],
    )
    db.add(invoice)
    db.flush()
    return record


def create_cancellation_record(
    db: Session,
    invoice: Invoice,
    *,
    reason: str,
) -> FiscalInvoiceRecord:
    if invoice.status == "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Draft invoices do not have a fiscal record to cancel",
        )
    if (
        db.query(FiscalInvoiceRecord)
        .filter(
            FiscalInvoiceRecord.invoice_id == invoice.id,
            FiscalInvoiceRecord.record_type == "anulacion",
        )
        .first()
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This invoice already has a fiscal cancellation record",
        )

    company = invoice.company
    previous = _latest_record(db, invoice.company_id)
    generated_at = datetime.now(timezone.utc)
    issuer = invoice.issuer_snapshot or {}
    official = {
        "issuer_name": issuer.get("name") or company.name,
        "issuer_tax_id": _normalize_tax_id(
            issuer.get("tax_id") or company.tax_id
        ),
        "invoice_number": invoice.invoice_number,
        "issue_date": _date(invoice.issue_date),
        "generated_at": generated_at.isoformat(timespec="seconds"),
        "previous_record": _previous_record_data(previous),
        "external_reference": f"workhive-cancellation-{invoice.id}",
        **_software_identity(company),
    }
    if not _valid_nif(official["issuer_tax_id"]):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Cannot issue invoice. Invalid: issuer tax ID",
        )
    official["record_hash"] = calculate_cancellation_hash(
        CancellationHashInput(
            issuer_tax_id=official["issuer_tax_id"],
            invoice_number=official["invoice_number"],
            issue_date=official["issue_date"],
            previous_hash=previous.record_hash if previous else None,
            generated_at=official["generated_at"],
        )
    )
    readiness = get_verifactu_readiness()
    submission_status = (
        "pending_submission"
        if readiness.submission_available
        else "not_configured"
    )
    record = FiscalInvoiceRecord(
        invoice_id=invoice.id,
        company_id=invoice.company_id,
        record_type="anulacion",
        payload={
            "schema_version": "AEAT-SIF-1.0",
            "record_type": "anulacion",
            "official": official,
        },
        request_xml=build_cancellation_xml(official),
        previous_hash=previous.record_hash if previous else None,
        record_hash=official["record_hash"],
        submission_status=submission_status,
        operation_reason=reason,
    )
    db.add(record)
    invoice.status = "annulled"
    invoice.fiscal_submission_status = submission_status
    db.add(invoice)
    db.flush()
    return record


def issue_invoice_in_transaction(
    db: Session,
    invoice: Invoice,
    *,
    series: str,
) -> Invoice:
    company = db.query(Company).filter(Company.id == invoice.company_id).first()
    client = (
        db.query(Client)
        .filter(
            Client.id == invoice.client_id,
            Client.company_id == invoice.company_id,
        )
        .first()
    )
    if not company or not client:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Issuer or recipient is unavailable",
        )
    issuer_snapshot, recipient_snapshot = party_snapshots(
        company,
        client,
        invoice,
    )
    validate_issuance(issuer_snapshot, recipient_snapshot, invoice)

    if invoice.invoice_number.upper().startswith("DRAFT-"):
        invoice.invoice_number = invoice_repo.generate_invoice_number(
            db,
            invoice.company_id,
            series=series,
            issue_date=invoice.issue_date,
        )
    generated_at = datetime.now(timezone.utc)
    invoice.status = "issued"
    invoice.issued_at = generated_at
    invoice.issuer_snapshot = issuer_snapshot
    invoice.recipient_snapshot = recipient_snapshot
    db.add(invoice)
    db.flush()
    create_fiscal_record(
        db,
        invoice,
        company,
        issuer_snapshot,
        recipient_snapshot,
        generated_at,
    )
    return invoice
