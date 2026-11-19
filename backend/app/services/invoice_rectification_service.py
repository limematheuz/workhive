import uuid
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.schemas.invoice import RectificationCreate
from app.schemas.invoice_item import RectificationInvoiceItemCreate
from app.repositories import invoice_item as invoice_item_repo
from app.services.currency_invoice_documents import inherit_rectification
from app.services.invoice_pdf_storage import delete_invoice_pdf


def create(
    db: Session,
    company_id: int,
    original_invoice_id: int,
    data: RectificationCreate, *, require_feature, statuses, issue, render,
) -> Invoice:
    require_feature(db, company_id)
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
    if original.status not in statuses:
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
        notes = f"Factura original {original.invoice_number}"
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
                    description=original_item.description,
                    quantity=float(original_item.quantity),
                    unit_price=-float(original_item.unit_price),
                    tax_rate=float(original_item.tax_rate),
                ),
            )
        db.flush()
        db.refresh(rectification)
        invoice_item_repo.recalculate_invoice_totals(db, rectification)
        inherit_rectification(db,original,rectification)
        issue(db, rectification, series="R")
        generated_path = render(rectification)
        db.add(rectification)
        original.status = "rectified"
        db.add(original)
        db.commit()
        db.refresh(rectification)
        return rectification
    except Exception:
        db.rollback()
        if generated_path:
            delete_invoice_pdf(generated_path)
        raise
