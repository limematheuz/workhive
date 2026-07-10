from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.invoice_item import InvoiceItem
from app.schemas.invoice_item import InvoiceItemCreate, InvoiceItemUpdate
from app.repositories import invoice_item as invoice_item_repo
from app.repositories import task_item as task_item_repo
from app.repositories import invoice as invoice_repo


def get_invoice_items(
    db: Session, company_id: int, invoice_id: int
) -> list[InvoiceItem]:
    existing = invoice_repo.get_invoice(db, company_id, invoice_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
        )
    return invoice_item_repo.get_invoice_items(db, invoice_id)


def get_invoice_item(db: Session, item_id: int) -> InvoiceItem | None:
    existing = invoice_item_repo.get_invoice_item(db, item_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice Item not found"
        )
    return existing


def create_invoice_item(
    db: Session,
    company_id: int,
    invoice_id: int,
    invoice_item_data: InvoiceItemCreate,
) -> InvoiceItem:
    existing = invoice_repo.get_invoice(db, company_id, invoice_id)

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
        )
    if existing.status != "draft":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    try:
        if invoice_item_data.task_item_id is not None:
            task_item = task_item_repo.get_task_item(
                db, company_id, invoice_item_data.task_item_id
            )
            if not task_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Task Item not found",
                )
            if task_item.is_invoiced:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Task Item is already invoiced",
                )
            task_item.is_invoiced = True
            db.add(task_item)

        item = invoice_item_repo.create_invoice_item(
            db, invoice_id, invoice_item_data
        )
        db.flush()
        db.refresh(existing)
        invoice_item_repo.recalculate_invoice_totals(db, existing)
        db.commit()
        db.refresh(item)
        return item
    except Exception:
        db.rollback()
        raise


def update_invoice_item(
    db: Session,
    company_id: int,
    invoice_id: int,
    item_id: int,
    item_data: InvoiceItemUpdate,
) -> InvoiceItem:
    existing_item = invoice_item_repo.get_invoice_item(db, item_id)
    if not existing_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice Item not found"
        )
    db_invoice = invoice_repo.get_invoice(db, company_id, invoice_id)
    if not db_invoice or existing_item.invoice_id != invoice_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
        )
    if db_invoice.status != "draft":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    try:
        if "task_item_id" in item_data.model_fields_set:
            new_task_id = item_data.task_item_id
            if new_task_id != existing_item.task_item_id:
                if existing_item.task_item_id is not None:
                    old_task = task_item_repo.get_task_item(
                        db, company_id, existing_item.task_item_id
                    )
                    if old_task:
                        old_task.is_invoiced = False
                        db.add(old_task)
                if new_task_id is not None:
                    new_task = task_item_repo.get_task_item(
                        db, company_id, new_task_id
                    )
                    if not new_task:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="New Task Item not found",
                        )
                    if new_task.is_invoiced:
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="New Task Item is already invoiced",
                        )
                    new_task.is_invoiced = True
                    db.add(new_task)
        item = invoice_item_repo.update_invoice_item(
            db, existing_item, item_data
        )
        invoice_item_repo.recalculate_invoice_totals(db, db_invoice)
        db.commit()
        db.refresh(item)
        return item
    except Exception:
        db.rollback()
        raise


def delete_invoice_item(
    db: Session, company_id: int, invoice_id: int, item_id: int
) -> None:
    existing_item = invoice_item_repo.get_invoice_item(db, item_id)
    if not existing_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice Item not found"
        )
    db_invoice = invoice_repo.get_invoice(db, company_id, invoice_id)
    if not db_invoice or existing_item.invoice_id != invoice_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
        )
    if db_invoice.status != "draft":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    try:
        if existing_item.task_item_id is not None:
            task_item = task_item_repo.get_task_item(
                db, company_id, existing_item.task_item_id
            )
            if task_item:
                task_item.is_invoiced = False
                db.add(task_item)
        invoice_item_repo.delete_invoice_item(db, existing_item)
        db.flush()
        db.refresh(db_invoice)
        invoice_item_repo.recalculate_invoice_totals(db, db_invoice)
        db.commit()
    except Exception:
        db.rollback()
        raise
