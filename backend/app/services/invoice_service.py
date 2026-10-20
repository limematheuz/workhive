import logging
import uuid
from decimal import Decimal
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.client import Client
from app.models.invoice import Invoice
from app.models.task_item import TaskItem
from app.repositories import client as client_repo
from app.repositories import invoice as invoice_repo
from app.repositories import invoice_item as invoice_item_repo
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceDraftCreate,
    InvoiceEmailRequest,
    InvoiceUpdate,
    RectificationCreate,
)
from app.schemas.invoice_item import InvoiceItemCreate, RectificationInvoiceItemCreate
from app.services import (
    email_service,
    fiscal_submission_service,
    invoice_email_contact_service,
)
from app.services.invoice_fiscal import (
    party_snapshots,
    issue_invoice_in_transaction,
)
from app.services.invoice_pdf import (
    generate_invoice_pdf,
    generate_invoice_preview_pdf,
)
from app.services.invoice_pdf_storage import delete_invoice_pdf, resolve_invoice_pdf
from app.services.storage_service import StoredObject
from app.services.invoice_update_policy_service import (
    apply_issued_status_transition,
    task_ids_from_invoice_items,
    validate_draft_status_update,
)
from app.services.invoice_tasks import (  # noqa: F401
    apply_task_amounts_to_invoice_item,
    get_invoiceable_completed_tasks,
    validate_invoice_client_for_linked_tasks,
    validate_task_for_invoice,
)
from app.services.entitlement_service import require_company_feature


RECTIFIABLE_STATUSES = {"issued", "partially_paid", "paid", "overdue"}
PAYMENT_STATUSES = {"issued", "partially_paid", "paid", "overdue"}
logger = logging.getLogger(__name__)


def _require_invoices_feature(db: Session, company_id: int) -> None:
    require_company_feature(db, company_id=company_id, code="features.invoices")


def get_invoices(
    db: Session,
    company_id: int,
    client_id: int | None = None,
    invoice_status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Invoice]:
    _require_invoices_feature(db, company_id)
    return invoice_repo.get_invoices(
        db, company_id, client_id, invoice_status, skip, limit
    )


def get_invoice(db: Session, company_id: int, invoice_id: int) -> Invoice:
    _require_invoices_feature(db, company_id)
    existing = invoice_repo.get_invoice(db, company_id, invoice_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
        )
    return existing


def _validate_client(db: Session, company_id: int, client_id: int) -> Client:
    client = client_repo.get_client_by_id(db, client_id, company_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )
    return client


def _ensure_invoice_number_available(
    db: Session,
    company_id: int,
    invoice_number: str | None,
    *,
    ignore_invoice_id: int | None = None,
) -> None:
    normalized = (invoice_number or "").strip()
    if not normalized:
        return
    query = db.query(Invoice).filter(
        Invoice.company_id == company_id,
        Invoice.invoice_number == normalized,
    )
    if ignore_invoice_id is not None:
        query = query.filter(Invoice.id != ignore_invoice_id)
    if query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invoice number already exists",
        )


def create_invoice(
    db: Session, company_id: int, invoice_data: InvoiceCreate
) -> Invoice:
    _require_invoices_feature(db, company_id)
    _validate_client(db, company_id, invoice_data.client_id)
    _ensure_invoice_number_available(db, company_id, invoice_data.invoice_number)
    try:
        invoice = invoice_repo.create_invoice(
            db,
            company_id,
            invoice_data,
            draft_number=f"DRAFT-{uuid.uuid4().hex[:12].upper()}",
        )
        db.commit()
        db.refresh(invoice)
        return invoice
    except Exception:
        db.rollback()
        raise


def create_invoice_draft(
    db: Session, company_id: int, data: InvoiceDraftCreate
) -> Invoice:
    _require_invoices_feature(db, company_id)
    try:
        _validate_client(db, company_id, data.client_id)
        _ensure_invoice_number_available(db, company_id, data.invoice_number)
        task_ids_from_invoice_items(data.items)

        header = InvoiceCreate(**data.model_dump(exclude={"items"}))
        invoice = invoice_repo.create_invoice(
            db,
            company_id,
            header,
            draft_number=f"DRAFT-{uuid.uuid4().hex[:12].upper()}",
        )
        for item_data in data.items:
            if item_data.task_item_id is not None:
                task = validate_task_for_invoice(
                    db,
                    company_id,
                    item_data.task_item_id,
                    data.client_id,
                )
                item_data = apply_task_amounts_to_invoice_item(task, item_data)
                task.is_invoiced = True
                db.add(task)
            invoice_item_repo.create_invoice_item(db, invoice.id, item_data)
        db.flush()
        db.refresh(invoice)
        invoice_item_repo.recalculate_invoice_totals(db, invoice)
        db.commit()
        db.refresh(invoice)
        return invoice
    except Exception:
        db.rollback()
        raise


def issue_invoice(db: Session, company_id: int, invoice_id: int) -> Invoice:
    _require_invoices_feature(db, company_id)
    invoice = (
        db.query(Invoice)
        .filter(Invoice.company_id == company_id, Invoice.id == invoice_id)
        .with_for_update()
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status == "issued" and invoice.invoice_hash:
        if not invoice.pdf_storage_key and not invoice.pdf_path:
            generated_key = None
            try:
                generated_key = generate_invoice_pdf(invoice)
                db.add(invoice)
                db.commit()
                db.refresh(invoice)
            except Exception:
                db.rollback()
                delete_invoice_pdf(generated_key)
                raise
        return invoice
    if invoice.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft invoices can be issued",
        )
    generated_key = None
    try:
        issue_invoice_in_transaction(db, invoice, series="INV")
        generated_key = generate_invoice_pdf(invoice)
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        if settings.VERIFACTU_AUTO_SUBMIT:
            record = fiscal_submission_service.latest_invoice_record(
                db,
                company_id,
                invoice.id,
            )
            fiscal_submission_service.submit_fiscal_record(
                db,
                company_id,
                record.id,
            )
            db.refresh(invoice)
        return invoice
    except Exception:
        db.rollback()
        delete_invoice_pdf(generated_key)
        raise


def get_invoice_pdf(
    db: Session, company_id: int, invoice_id: int
) -> tuple[Invoice, StoredObject]:
    invoice = get_invoice(db, company_id, invoice_id)
    if invoice.status == "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Issue the invoice before downloading its definitive PDF",
        )
    if not invoice.pdf_storage_key and not invoice.pdf_path:
        generated_key = None
        try:
            generated_key = generate_invoice_pdf(invoice)
            db.add(invoice)
            db.commit()
            db.refresh(invoice)
        except Exception:
            db.rollback()
            delete_invoice_pdf(generated_key)
            raise
    return invoice, resolve_invoice_pdf(invoice)


def email_invoice(
    db: Session,
    company_id: int,
    invoice_id: int,
    data: InvoiceEmailRequest,
    *,
    sender_email: str | None = None,
) -> tuple[Invoice, str]:
    invoice = get_invoice(db, company_id, invoice_id)
    preview_pdf_path: Path | None = None
    locale = data.locale or "es"
    document_label = "Invoice" if locale == "en" else "Factura"
    if invoice.status == "draft":
        issuer, recipient = party_snapshots(invoice.company, invoice.client, invoice)
        preview_pdf_path = generate_invoice_preview_pdf(
            invoice,
            issuer,
            recipient,
            document_label="PROFORMA",
        )
        pdf_contents = preview_pdf_path.read_bytes()
        document_label = "Proforma"
    else:
        invoice, stored_pdf = get_invoice_pdf(db, company_id, invoice_id)
        pdf_contents = stored_pdf.contents
        recipient = invoice.recipient_snapshot or {}
        issuer = invoice.issuer_snapshot or {}
    recipient_emails = [
        str(email) for email in (data.recipient_emails or []) if str(email).strip()
    ]
    if data.recipient_email:
        recipient_emails.append(str(data.recipient_email))
    if not recipient_emails and recipient.get("email"):
        recipient_emails.append(str(recipient["email"]))
    recipient_emails = list(dict.fromkeys(recipient_emails))
    if not recipient_emails:
        if preview_pdf_path:
            preview_pdf_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The invoice recipient does not have an email address",
        )
    if (
        data.save_recipient_to_client_id is not None
        and data.save_recipient_to_client_id != invoice.client_id
    ):
        if preview_pdf_path:
            preview_pdf_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The email can only be saved to this invoice's client",
        )
    if data.save_recipient_to_client_id is not None and len(recipient_emails) != 1:
        if preview_pdf_path:
            preview_pdf_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Select exactly one recipient before saving it to a client",
        )
    try:
        sent = email_service.send_invoice_email(
            recipient_email=recipient_emails,
            recipient_name=recipient.get("name")
            or ("client" if locale == "en" else "cliente"),
            issuer_name=issuer.get("name") or "WorkHive",
            invoice_number=invoice.invoice_number,
            pdf_contents=pdf_contents,
            subject=data.subject,
            custom_message=data.message,
            sender_copy_email=sender_email if data.send_copy else None,
            copy_emails=[str(email) for email in (data.copy_emails or [])],
            document_label=document_label,
            locale=locale,
        )
    except Exception:
        logger.exception("Invoice email delivery failed")
        sent = False
    finally:
        if preview_pdf_path:
            preview_pdf_path.unlink(missing_ok=True)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Invoice email delivery is not configured or unavailable",
        )
    if data.save_recipient_to_client_id is not None:
        invoice_email_contact_service.save_email_to_client(
            db,
            company_id,
            data.save_recipient_to_client_id,
            recipient_emails,
        )
    if data.save_recipients:
        invoice_email_contact_service.remember_document_recipients(
            db,
            company_id,
            recipient_emails,
        )
    return invoice, ", ".join(recipient_emails)


def _validate_invoice_update_links(
    db: Session,
    company_id: int,
    invoice: Invoice,
    changes: dict,
    replacement_items: list[InvoiceItemCreate] | None,
) -> dict[int, TaskItem]:
    target_client_id = changes.get("client_id") or invoice.client_id
    client_changed = changes.get("client_id") is not None
    if client_changed:
        _validate_client(db, company_id, target_client_id)

    if replacement_items is not None:
        return {
            task_id: validate_task_for_invoice(
                db,
                company_id,
                task_id,
                target_client_id,
                linked_invoice_id=invoice.id,
            )
            for task_id in task_ids_from_invoice_items(replacement_items)
        }

    if client_changed:
        validate_invoice_client_for_linked_tasks(
            db,
            company_id,
            invoice.id,
            target_client_id,
            [
                item.task_item_id
                for item in invoice.items
                if item.task_item_id is not None
            ],
        )
    return {}


def _cancel_draft_invoice(db: Session, invoice: Invoice) -> None:
    for item in list(invoice.items):
        if item.task_item_id is not None and item.task_item:
            item.task_item.is_invoiced = False
            db.add(item.task_item)
    invoice.items.clear()
    invoice.base_amount = Decimal(0)
    invoice.tax_amount = Decimal(0)
    invoice.total_amount = Decimal(0)


def _replace_draft_invoice_items(
    db: Session,
    invoice: Invoice,
    replacement_items: list[InvoiceItemCreate],
    validated_tasks: dict[int, TaskItem],
) -> None:
    replacement_task_ids = {
        item.task_item_id for item in replacement_items if item.task_item_id is not None
    }
    for item in list(invoice.items):
        if (
            item.task_item_id is not None
            and item.task_item_id not in replacement_task_ids
            and item.task_item
        ):
            item.task_item.is_invoiced = False
            db.add(item.task_item)
    invoice.items.clear()
    db.flush()

    for item_data in replacement_items:
        if item_data.task_item_id is not None:
            task = validated_tasks[item_data.task_item_id]
            item_data = apply_task_amounts_to_invoice_item(task, item_data)
            task.is_invoiced = True
        invoice_item_repo.create_invoice_item(db, invoice.id, item_data)


def _apply_draft_invoice_changes(
    db: Session,
    invoice: Invoice,
    requested_status: str | None,
    replacement_items: list[InvoiceItemCreate] | None,
    validated_tasks: dict[int, TaskItem],
) -> None:
    validate_draft_status_update(requested_status)
    if requested_status == "cancelled":
        _cancel_draft_invoice(db, invoice)
    elif replacement_items is not None:
        _replace_draft_invoice_items(
            db,
            invoice,
            replacement_items,
            validated_tasks,
        )


def _normalize_invoice_update_number(
    db: Session,
    company_id: int,
    invoice: Invoice,
    invoice_data: InvoiceUpdate,
    changes: dict,
) -> None:
    if changes.get("invoice_number") is None:
        return
    normalized = changes["invoice_number"].strip()
    _ensure_invoice_number_available(
        db,
        company_id,
        normalized,
        ignore_invoice_id=invoice.id,
    )
    invoice_data.invoice_number = normalized or invoice.invoice_number


def update_invoice(
    db: Session, company_id: int, invoice_id: int, invoice_data: InvoiceUpdate
) -> Invoice:
    invoice = get_invoice(db, company_id, invoice_id)
    changes = invoice_data.model_dump(exclude_unset=True)
    replacement_items = (
        invoice_data.items if "items" in invoice_data.model_fields_set else None
    )
    changes.pop("items", None)
    requested_status = changes.get("status")
    validated_tasks = _validate_invoice_update_links(
        db,
        company_id,
        invoice,
        changes,
        replacement_items,
    )

    if requested_status == "issued":
        if invoice_data.model_fields_set != {"status"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Issue the invoice separately from draft edits",
            )
        return issue_invoice(db, company_id, invoice_id)

    try:
        if invoice.status == "draft":
            _apply_draft_invoice_changes(
                db,
                invoice,
                requested_status,
                replacement_items,
                validated_tasks,
            )
        else:
            apply_issued_status_transition(
                invoice,
                changes,
                replacement_items,
                requested_status,
            )

        _normalize_invoice_update_number(
            db,
            company_id,
            invoice,
            invoice_data,
            changes,
        )
        invoice_repo.update_invoice(db, invoice, invoice_data)
        if replacement_items is not None and requested_status != "cancelled":
            invoice_item_repo.recalculate_invoice_totals(db, invoice)
        db.commit()
        db.refresh(invoice)
        db.expire(invoice, ["items"])
        return invoice
    except Exception:
        db.rollback()
        raise


def create_rectification_invoice(
    db: Session,
    company_id: int,
    original_invoice_id: int,
    data: RectificationCreate,
) -> Invoice:
    _require_invoices_feature(db, company_id)
    original = (
        db.query(Invoice)
        .filter(
            Invoice.company_id == company_id,
            Invoice.id == original_invoice_id,
        )
        .with_for_update()
        .first()
    )
    if not original:
        raise HTTPException(status_code=404, detail="Original invoice not found")
    if original.is_rectification:
        raise HTTPException(
            status_code=400, detail="A rectification invoice cannot be rectified"
        )
    if original.status not in RECTIFIABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Only issued, paid, or overdue invoices can be rectified",
        )
    if not original.items:
        raise HTTPException(status_code=400, detail="The original invoice has no lines")
    if (
        db.query(Invoice)
        .filter(
            Invoice.original_invoice_id == original.id,
            Invoice.is_rectification.is_(True),
            Invoice.status != "cancelled",
        )
        .first()
    ):
        raise HTTPException(
            status_code=409, detail="This invoice already has a rectification"
        )

    generated_path = None
    try:
        notes = (
            f"Rectification of invoice {original.invoice_number}. Reason: {data.reason}"
        )
        if data.notes:
            notes = f"{notes}\n{data.notes}"
        rectification = Invoice(
            company_id=company_id,
            client_id=original.client_id,
            invoice_number=f"DRAFT-{uuid.uuid4().hex[:12].upper()}",
            issue_date=data.issue_date,
            due_date=data.due_date,
            status="draft",
            is_rectification=True,
            original_invoice_id=original.id,
            rectification_reason=data.reason,
            rectification_reason_code=data.reason_code,
            notes=notes,
            discount=original.discount,
            equivalence_surcharge=original.equivalence_surcharge,
            retention=original.retention,
            terms=original.terms,
            shipping_address=original.shipping_address,
            custom_issuer_info=original.custom_issuer_info,
            custom_recipient_info=original.custom_recipient_info,
        )
        db.add(rectification)
        db.flush()

        for original_item in original.items:
            invoice_item_repo.create_invoice_item(
                db,
                rectification.id,
                RectificationInvoiceItemCreate(
                    task_item_id=None,
                    description=f"Rectification: {original_item.description}",
                    quantity=float(original_item.quantity),
                    unit_price=-float(original_item.unit_price),
                    tax_rate=float(original_item.tax_rate),
                ),
            )
        db.flush()
        db.refresh(rectification)
        invoice_item_repo.recalculate_invoice_totals(db, rectification)
        issue_invoice_in_transaction(db, rectification, series="R")
        generated_path = generate_invoice_pdf(rectification)
        db.add(rectification)
        original.status = "rectified"
        db.add(original)
        db.commit()
        db.refresh(rectification)
        return rectification
    except Exception:
        db.rollback()
        if generated_path:
            generated_path.unlink(missing_ok=True)
        raise
