"""Copy controlled legacy fiscal files into private object storage.

This is a maintenance boundary, not an HTTP workflow. It intentionally leaves
the source files untouched so operations retain an independent copy until its
documented retention policy permits removal.
"""

from dataclasses import dataclass, field
from hashlib import sha256
from pathlib import Path

from fastapi import HTTPException
from lxml import etree
from sqlalchemy.orm import Session

from app.core.config import settings
from app.repositories import legacy_document_storage as legacy_repo
from app.services import company_fiscal_settings_service
from app.services.storage_service import (
    ObjectStorage,
    build_document_key,
    get_object_storage,
)


@dataclass
class LegacyDocumentMigrationReport:
    examined: int = 0
    ready: int = 0
    migrated: int = 0
    skipped: int = 0
    failures: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, object]:
        return {
            "examined": self.examined,
            "ready": self.ready,
            "migrated": self.migrated,
            "skipped": self.skipped,
            "failures": self.failures,
        }


class LegacyDocumentMigrationError(ValueError):
    """A legacy file cannot safely become the canonical stored document."""


def _legacy_contents(path_value: str, *, root_value: str) -> bytes:
    root = Path(root_value).expanduser().resolve()
    path = Path(path_value).expanduser().resolve()
    if root not in path.parents or not path.is_file():
        raise LegacyDocumentMigrationError("legacy source is unavailable")
    try:
        contents = path.read_bytes()
    except OSError as error:
        raise LegacyDocumentMigrationError("legacy source cannot be read") from error
    if not contents:
        raise LegacyDocumentMigrationError("legacy source is empty")
    return contents


def _verify_known_hash(contents: bytes, expected_hash: str | None) -> str:
    actual_hash = sha256(contents).hexdigest()
    if expected_hash and expected_hash != actual_hash:
        raise LegacyDocumentMigrationError("legacy source hash does not match")
    return actual_hash


def _store_verified_copy(
    *,
    storage: ObjectStorage,
    company_id: int,
    document_type: str,
    extension: str,
    contents: bytes,
    content_type: str,
) -> str:
    storage_key = build_document_key(company_id, document_type, extension)
    storage.put(storage_key, contents, content_type)
    try:
        copied = storage.get(storage_key)
        if copied.contents != contents or copied.content_type != content_type:
            raise LegacyDocumentMigrationError("object storage verification failed")
    except Exception:
        storage.delete(storage_key)
        raise
    return storage_key


def _commit_record(db: Session, *, storage: ObjectStorage, storage_key: str) -> None:
    try:
        db.commit()
    except Exception:
        db.rollback()
        storage.delete(storage_key)
        raise


def _migrate_invoice_pdf(
    db: Session,
    *,
    invoice_id: int,
    apply: bool,
    storage: ObjectStorage,
) -> bool:
    invoice = legacy_repo.lock_invoice(db, invoice_id=invoice_id)
    if invoice is None or invoice.pdf_storage_key or not invoice.pdf_path:
        return False
    contents = _legacy_contents(
        invoice.pdf_path,
        root_value=settings.INVOICE_PDF_STORAGE_PATH,
    )
    if not contents.startswith(b"%PDF-"):
        raise LegacyDocumentMigrationError("legacy invoice file is not a PDF")
    content_hash = _verify_known_hash(contents, invoice.pdf_sha256)
    if not apply:
        return True
    storage_key = _store_verified_copy(
        storage=storage,
        company_id=invoice.company_id,
        document_type="invoices/pdf",
        extension="pdf",
        contents=contents,
        content_type="application/pdf",
    )
    invoice.pdf_storage_key = storage_key
    invoice.pdf_content_type = "application/pdf"
    invoice.pdf_size_bytes = len(contents)
    invoice.pdf_sha256 = content_hash
    invoice.pdf_path = None
    db.add(invoice)
    _commit_record(db, storage=storage, storage_key=storage_key)
    return True


def _migrate_facturae(
    db: Session,
    *,
    invoice_id: int,
    apply: bool,
    storage: ObjectStorage,
) -> bool:
    invoice = legacy_repo.lock_invoice(db, invoice_id=invoice_id)
    if invoice is None or invoice.facturae_storage_key or not invoice.facturae_path:
        return False
    contents = _legacy_contents(
        invoice.facturae_path,
        root_value=settings.ELECTRONIC_INVOICE_STORAGE_PATH,
    )
    try:
        etree.fromstring(contents)
    except etree.XMLSyntaxError as error:
        raise LegacyDocumentMigrationError("legacy Facturae file is not XML") from error
    content_hash = _verify_known_hash(contents, invoice.facturae_sha256)
    signed = invoice.facturae_signature_status == "signed"
    content_type = "application/octet-stream" if signed else "application/xml"
    if not apply:
        return True
    storage_key = _store_verified_copy(
        storage=storage,
        company_id=invoice.company_id,
        document_type="invoices/facturae",
        extension="xsig" if signed else "xml",
        contents=contents,
        content_type=content_type,
    )
    invoice.facturae_storage_key = storage_key
    invoice.facturae_content_type = content_type
    invoice.facturae_size_bytes = len(contents)
    invoice.facturae_sha256 = content_hash
    invoice.facturae_path = None
    db.add(invoice)
    _commit_record(db, storage=storage, storage_key=storage_key)
    return True


def _migrate_certificate(
    db: Session,
    *,
    fiscal_settings_id: int,
    apply: bool,
    storage: ObjectStorage,
) -> bool:
    fiscal_settings = legacy_repo.lock_fiscal_settings(
        db, fiscal_settings_id=fiscal_settings_id
    )
    if (
        fiscal_settings is None
        or fiscal_settings.certificate_storage_key
        or not fiscal_settings.certificate_path
    ):
        return False
    contents = _legacy_contents(
        fiscal_settings.certificate_path,
        root_value=settings.FISCAL_CERTIFICATE_STORAGE_PATH,
    )
    try:
        password = company_fiscal_settings_service.decrypt_password(
            fiscal_settings.certificate_password_encrypted
        )
    except ValueError as error:
        raise LegacyDocumentMigrationError(
            "legacy certificate password cannot be decrypted"
        ) from error
    if not password:
        raise LegacyDocumentMigrationError("legacy certificate password is unavailable")
    try:
        company_fiscal_settings_service.validate_certificate_contents(contents, password)
    except HTTPException as error:
        raise LegacyDocumentMigrationError(
            "legacy certificate cannot be validated"
        ) from error
    content_hash = _verify_known_hash(contents, fiscal_settings.certificate_sha256)
    if not apply:
        return True
    storage_key = _store_verified_copy(
        storage=storage,
        company_id=fiscal_settings.company_id,
        document_type="fiscal-certificates",
        extension="p12",
        contents=contents,
        content_type="application/x-pkcs12",
    )
    fiscal_settings.certificate_storage_key = storage_key
    fiscal_settings.certificate_content_type = "application/x-pkcs12"
    fiscal_settings.certificate_size_bytes = len(contents)
    fiscal_settings.certificate_sha256 = content_hash
    fiscal_settings.certificate_path = None
    db.add(fiscal_settings)
    _commit_record(db, storage=storage, storage_key=storage_key)
    return True


def _record(
    report: LegacyDocumentMigrationReport,
    *,
    label: str,
    apply: bool,
    operation,
) -> None:
    report.examined += 1
    try:
        if operation():
            if apply:
                report.migrated += 1
            else:
                report.ready += 1
        else:
            report.skipped += 1
    except LegacyDocumentMigrationError as error:
        report.failures.append(f"{label}: {error}")


def migrate_legacy_documents(
    db: Session,
    *,
    apply: bool,
    company_ids: set[int] | None = None,
    storage: ObjectStorage | None = None,
) -> LegacyDocumentMigrationReport:
    """Inspect or migrate database-linked legacy files without deleting sources."""
    resolved_storage = storage or get_object_storage()
    if apply:
        resolved_storage.check()
    report = LegacyDocumentMigrationReport()
    for invoice_id in legacy_repo.list_legacy_invoice_pdf_ids(
        db, company_ids=company_ids
    ):
        _record(
            report,
            label=f"invoice:{invoice_id}:pdf",
            apply=apply,
            operation=lambda invoice_id=invoice_id: _migrate_invoice_pdf(
                db, invoice_id=invoice_id, apply=apply, storage=resolved_storage
            ),
        )
    for invoice_id in legacy_repo.list_legacy_facturae_ids(
        db, company_ids=company_ids
    ):
        _record(
            report,
            label=f"invoice:{invoice_id}:facturae",
            apply=apply,
            operation=lambda invoice_id=invoice_id: _migrate_facturae(
                db, invoice_id=invoice_id, apply=apply, storage=resolved_storage
            ),
        )
    for fiscal_settings_id in legacy_repo.list_legacy_fiscal_settings_ids(
        db, company_ids=company_ids
    ):
        _record(
            report,
            label=f"fiscal-settings:{fiscal_settings_id}:certificate",
            apply=apply,
            operation=lambda fiscal_settings_id=fiscal_settings_id: _migrate_certificate(
                db,
                fiscal_settings_id=fiscal_settings_id,
                apply=apply,
                storage=resolved_storage,
            ),
        )
    return report
