import hashlib
import logging
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, status
from lxml import etree
from sqlalchemy.orm import Session

from app.core.config import settings
from app.integrations.facturae.signature import sign_facturae_xml
from app.integrations.facturae.xml import (
    build_facturae_xml,
    validate_facturae_xml,
)
from app.models.invoice import Invoice


logger = logging.getLogger(__name__)


def _storage_root() -> Path:
    return Path(settings.ELECTRONIC_INVOICE_STORAGE_PATH).expanduser().resolve()


def facturae_readiness(invoice: Invoice | None = None) -> dict:
    certificate_path = settings.facturae_certificate_path
    certificate_configured = bool(
        certificate_path
        and settings.facturae_certificate_password
        and Path(certificate_path).expanduser().is_file()
    )
    missing_fields: list[str] = []
    if invoice:
        company = invoice.company
        client = invoice.client
        for label, value in (
            ("company.postal_code", company.postal_code),
            ("company.city", company.city),
            ("company.province", company.province),
            ("client.legal_number", client.legal_number),
            ("client.postal_code", client.postal_code),
            ("client.city", client.city),
        ):
            if not value:
                missing_fields.append(label)
    return {
        "schema_version": "3.2.2",
        "schema_available": True,
        "certificate_configured": certificate_configured,
        "unsigned_generation_available": not missing_fields,
        "signed_generation_available": certificate_configured and not missing_fields,
        "missing_fields": missing_fields,
    }


def generate_facturae(
    db: Session,
    company_id: int,
    invoice_id: int,
    *,
    sign: bool,
) -> tuple[Invoice, Path]:
    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == invoice_id,
            Invoice.company_id == company_id,
        )
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    certificate_path = settings.facturae_certificate_path
    certificate_password = settings.facturae_certificate_password
    if sign and (not certificate_path or not certificate_password):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Facturae signing certificate is not configured",
        )
    try:
        xml = build_facturae_xml(invoice)
        if sign:
            xml = sign_facturae_xml(
                xml,
                certificate_path=certificate_path,
                certificate_password=certificate_password,
            )
            validate_facturae_xml(xml)
    except (
        ValueError,
        OSError,
        etree.DocumentInvalid,
        etree.XMLSyntaxError,
    ) as exc:
        logger.warning(
            "Facturae generation failed",
            extra={"error_type": type(exc).__name__},
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Facturae document could not be generated",
        ) from exc

    company_directory = _storage_root() / str(company_id)
    company_directory.mkdir(parents=True, exist_ok=True)
    suffix = "-signed.xsig" if sign else ".xml"
    destination = company_directory / f"facturae-{invoice.id}{suffix}"
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".facturae-{invoice.id}-",
        suffix=suffix,
        dir=company_directory,
    )
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        temporary.write_bytes(xml)
        os.chmod(temporary, 0o600)
        temporary.replace(destination)
        invoice.facturae_path = str(destination)
        invoice.facturae_sha256 = hashlib.sha256(xml).hexdigest()
        invoice.facturae_generated_at = datetime.now(timezone.utc)
        invoice.facturae_signature_status = "signed" if sign else "unsigned"
        invoice.facturae_signed_at = (
            datetime.now(timezone.utc) if sign else None
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
    except Exception:
        db.rollback()
        temporary.unlink(missing_ok=True)
        destination.unlink(missing_ok=True)
        raise
    return invoice, destination


def resolve_facturae(
    db: Session,
    company_id: int,
    invoice_id: int,
) -> tuple[Invoice, Path]:
    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == invoice_id,
            Invoice.company_id == company_id,
        )
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not invoice.facturae_path:
        raise HTTPException(status_code=404, detail="Facturae has not been generated")
    path = Path(invoice.facturae_path).expanduser().resolve()
    root = _storage_root()
    if root not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="Facturae file is unavailable")
    return invoice, path
