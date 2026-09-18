import hashlib
import logging
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
from app.services.storage_service import (
    ObjectNotFoundError,
    StoredObject,
    build_document_key,
    get_object_storage,
)
from app.services import facturae_signing_credentials_service


logger = logging.getLogger(__name__)


def _storage_root() -> Path:
    return Path(settings.ELECTRONIC_INVOICE_STORAGE_PATH).expanduser().resolve()


def facturae_readiness(invoice: Invoice | None = None) -> dict:
    certificate_configured = (
        facturae_signing_credentials_service.signing_certificate_is_configured()
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
) -> tuple[Invoice, StoredObject]:
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
    if sign and not facturae_signing_credentials_service.signing_certificate_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Facturae signing certificate is not configured",
        )
    try:
        xml = build_facturae_xml(invoice)
        if sign:
            with facturae_signing_credentials_service.facturae_signing_credentials() as (
                certificate_path,
                certificate_password,
            ):
                xml = sign_facturae_xml(
                    xml,
                    certificate_path=certificate_path,
                    certificate_password=certificate_password,
                )
            validate_facturae_xml(xml)
    except facturae_signing_credentials_service.FacturaeSigningCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Facturae signing certificate is unavailable",
        ) from exc
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

    previous_key = invoice.facturae_storage_key
    storage_key: str | None = None
    try:
        storage_key = build_document_key(
            company_id,
            "invoices/facturae",
            "xsig" if sign else "xml",
        )
        content_type = "application/octet-stream" if sign else "application/xml"
        get_object_storage().put(storage_key, xml, content_type)
        invoice.facturae_storage_key = storage_key
        invoice.facturae_content_type = content_type
        invoice.facturae_size_bytes = len(xml)
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
        if storage_key:
            try:
                get_object_storage().delete(storage_key)
            except Exception:
                logger.warning("Could not clean up generated Facturae object")
        raise
    if previous_key and previous_key != storage_key:
        try:
            get_object_storage().delete(previous_key)
        except Exception:
            logger.warning("Could not clean up replaced Facturae object")
    return invoice, StoredObject(contents=xml, content_type=content_type)


def resolve_facturae(
    db: Session,
    company_id: int,
    invoice_id: int,
) -> tuple[Invoice, StoredObject]:
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
    if invoice.facturae_storage_key:
        try:
            return invoice, get_object_storage().get(invoice.facturae_storage_key)
        except ObjectNotFoundError as error:
            raise HTTPException(
                status_code=404,
                detail="Facturae file is unavailable",
            ) from error
    if not invoice.facturae_path:
        raise HTTPException(status_code=404, detail="Facturae has not been generated")
    path = Path(invoice.facturae_path).expanduser().resolve()
    root = _storage_root()
    if root not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="Facturae file is unavailable")
    return invoice, StoredObject(
        contents=path.read_bytes(),
        content_type=(
            "application/xml"
            if invoice.facturae_signature_status == "unsigned"
            else "application/octet-stream"
        ),
    )
