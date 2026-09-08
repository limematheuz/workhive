from pathlib import Path

from fastapi import HTTPException, status

from app.core.config import settings
from app.models.invoice import Invoice
from app.services.storage_service import ObjectNotFoundError, StoredObject, get_object_storage


def delete_invoice_pdf(storage_key: str | None) -> None:
    if storage_key:
        try:
            get_object_storage().delete(storage_key)
        except Exception:
            # A failed cleanup must not conceal the database error that triggered it.
            pass


def resolve_invoice_pdf(invoice: Invoice) -> StoredObject:
    if invoice.pdf_storage_key:
        try:
            document = get_object_storage().get(invoice.pdf_storage_key)
        except ObjectNotFoundError as error:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The invoice PDF is unavailable",
            ) from error
        if not document.contents.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The invoice PDF is unavailable",
            )
        return document
    if not invoice.pdf_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The invoice PDF has not been generated",
        )
    root = Path(settings.INVOICE_PDF_STORAGE_PATH).expanduser().resolve()
    path = Path(invoice.pdf_path).expanduser().resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The invoice PDF is unavailable",
        )
    return StoredObject(contents=path.read_bytes(), content_type="application/pdf")
