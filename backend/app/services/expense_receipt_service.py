"""Private, expense-bound receipts; never expose their object keys as generic media."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import expense as expense_repo
from app.services import expense_service, organization_authorization_service
from app.services.image_service import validate_image
from app.services.storage_service import (
    ObjectNotFoundError,
    StoredObject,
    build_media_key,
    get_object_storage,
    normalize_key,
)


MAX_RECEIPT_BYTES = 10 * 1024 * 1024
_PRIVATE_PREFIX = "private-expense-receipt:"


def _company_id(db: Session, user: User, capability: str) -> int:
    organization_authorization_service.require_capability(db, user, capability)
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company required")
    return user.company_id


def _validated_file(contents: bytes, content_type: str | None) -> tuple[str, str]:
    if not contents:
        raise HTTPException(status_code=400, detail="El justificante está vacío")
    if len(contents) > MAX_RECEIPT_BYTES:
        raise HTTPException(status_code=413, detail="El justificante supera 10 MB")
    if contents.startswith(b"%PDF-"):
        detected_type, extension = "application/pdf", "pdf"
    else:
        try:
            detected_type, extension = validate_image(contents)
        except HTTPException as error:
            if error.status_code == status.HTTP_413_CONTENT_TOO_LARGE:
                raise
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Solo se permiten justificantes PDF, JPEG, PNG o WEBP válidos",
            ) from error
    if detected_type not in {"application/pdf", "image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=422, detail="Formato de justificante no permitido")
    if content_type != detected_type:
        raise HTTPException(status_code=422, detail="El tipo del archivo no coincide con su contenido")
    return detected_type, extension


def upload_receipt(
    db: Session,
    *,
    user: User,
    expense_id: int,
    contents: bytes,
    content_type: str | None,
):
    company_id = _company_id(db, user, "finance.manage")
    expense = expense_service.require_mutable_expense(db, company_id, expense_id)
    if expense.receipt_url:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este gasto ya tiene un justificante. No se sustituye sin revisión.",
        )
    detected_type, extension = _validated_file(contents, content_type)
    key = build_media_key(company_id, f"expense-receipts/{expense_id}", extension)
    storage = get_object_storage()
    storage.put(key, contents, detected_type)
    try:
        return expense_repo.update_expense(db, expense, receipt_url=f"{_PRIVATE_PREFIX}{key}")
    except Exception:
        db.rollback()
        storage.delete(key)
        raise


def download_receipt(db: Session, *, user: User, expense_id: int) -> tuple[StoredObject, str]:
    company_id = _company_id(db, user, "finance.read")
    expense = expense_service.get_expense(db, company_id, expense_id)
    reference = expense.receipt_url or ""
    key = reference.removeprefix(_PRIVATE_PREFIX)
    expected_prefix = f"company/{company_id}/expense-receipts/{expense_id}/"
    if not reference.startswith(_PRIVATE_PREFIX) or not key.startswith(expected_prefix):
        raise HTTPException(status_code=404, detail="Justificante privado no disponible")
    try:
        normalize_key(key)
    except ValueError:
        raise HTTPException(status_code=404, detail="Justificante privado no disponible") from None
    try:
        stored = get_object_storage().get(key)
    except ObjectNotFoundError:
        raise HTTPException(status_code=404, detail="Justificante privado no disponible") from None
    extension = key.rsplit(".", 1)[-1]
    return stored, f"justificante-{expense_id}.{extension}"
