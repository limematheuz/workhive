import base64
import hashlib
import logging
import os
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.serialization import pkcs12
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.integrations.aeat.verifactu import aeat_endpoint
from app.models.company_fiscal_settings import CompanyFiscalSettings
from app.schemas.fiscal_settings import CompanyFiscalSettingsUpdate
from app.services.storage_service import (
    ObjectNotFoundError,
    build_document_key,
    get_object_storage,
)


MAX_CERTIFICATE_BYTES = 2 * 1024 * 1024
ALLOWED_ENVIRONMENTS = {"test", "production"}
logger = logging.getLogger(__name__)


def _fernet() -> Fernet:
    key = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def _encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_password(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as error:
        raise ValueError(
            "Stored fiscal certificate password cannot be decrypted"
        ) from error


def _certificate_root() -> Path:
    return Path(settings.FISCAL_CERTIFICATE_STORAGE_PATH).expanduser().resolve()


def _certificate_path(company_id: int) -> Path:
    return _certificate_root() / str(company_id) / "certificate.p12"


def validate_certificate_contents(contents: bytes, password: str) -> None:
    """Reject malformed or unusable PKCS#12 data before it reaches storage."""
    try:
        private_key, certificate, _ = pkcs12.load_key_and_certificates(
            contents,
            password.encode("utf-8"),
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The certificate password is invalid or the file is not PKCS#12",
        ) from error
    if private_key is None or certificate is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The PKCS#12 file has no private key or certificate",
        )


def get_or_create_settings(
    db: Session,
    company_id: int,
) -> CompanyFiscalSettings:
    fiscal_settings = (
        db.query(CompanyFiscalSettings)
        .filter(CompanyFiscalSettings.company_id == company_id)
        .first()
    )
    if fiscal_settings:
        return fiscal_settings
    fiscal_settings = CompanyFiscalSettings(company_id=company_id)
    db.add(fiscal_settings)
    db.commit()
    db.refresh(fiscal_settings)
    return fiscal_settings


def update_settings(
    db: Session,
    company_id: int,
    data: CompanyFiscalSettingsUpdate,
) -> CompanyFiscalSettings:
    fiscal_settings = get_or_create_settings(db, company_id)
    if data.enabled is not None:
        fiscal_settings.enabled = data.enabled
    if data.environment is not None:
        fiscal_settings.environment = data.environment
    if data.quarterly_vat_enabled is not None:
        fiscal_settings.quarterly_vat_enabled = data.quarterly_vat_enabled
    if data.quarterly_withholding_enabled is not None:
        fiscal_settings.quarterly_withholding_enabled = (
            data.quarterly_withholding_enabled
        )
    if data.fiscal_reminder_days is not None:
        fiscal_settings.fiscal_reminder_days = data.fiscal_reminder_days
    db.add(fiscal_settings)
    db.commit()
    db.refresh(fiscal_settings)
    return fiscal_settings


def store_certificate(
    db: Session,
    company_id: int,
    *,
    contents: bytes,
    password: str,
) -> CompanyFiscalSettings:
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The certificate file is empty",
        )
    if len(contents) > MAX_CERTIFICATE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="The certificate file is too large",
        )
    validate_certificate_contents(contents, password)

    fiscal_settings = get_or_create_settings(db, company_id)
    previous_key = fiscal_settings.certificate_storage_key
    storage_key = build_document_key(company_id, "fiscal-certificates", "p12")
    try:
        get_object_storage().put(storage_key, contents, "application/x-pkcs12")
    except Exception:
        raise
    fiscal_settings.certificate_storage_key = storage_key
    fiscal_settings.certificate_sha256 = hashlib.sha256(contents).hexdigest()
    fiscal_settings.certificate_content_type = "application/x-pkcs12"
    fiscal_settings.certificate_size_bytes = len(contents)
    fiscal_settings.certificate_password_encrypted = _encrypt(password)
    fiscal_settings.certificate_uploaded_at = datetime.now(timezone.utc)
    db.add(fiscal_settings)
    try:
        db.commit()
        db.refresh(fiscal_settings)
    except Exception:
        db.rollback()
        try:
            get_object_storage().delete(storage_key)
        except Exception:
            logger.warning("Could not clean up fiscal certificate object")
        raise
    if previous_key and previous_key != storage_key:
        try:
            get_object_storage().delete(previous_key)
        except Exception:
            logger.warning("Could not clean up replaced fiscal certificate object")
    return fiscal_settings


def certificate_configured(fiscal_settings: CompanyFiscalSettings | None) -> bool:
    if not fiscal_settings:
        return False
    if not fiscal_settings.certificate_password_encrypted:
        return False
    if fiscal_settings.certificate_storage_key:
        try:
            return bool(get_object_storage().get(fiscal_settings.certificate_storage_key).contents)
        except ObjectNotFoundError:
            return False
    return bool(
        fiscal_settings.certificate_path
        and Path(fiscal_settings.certificate_path).is_file()
    )


def readiness_payload(
    fiscal_settings: CompanyFiscalSettings | None,
) -> dict:
    environment = (
        fiscal_settings.environment
        if fiscal_settings and fiscal_settings.environment in ALLOWED_ENVIRONMENTS
        else "test"
    )
    global_enabled = bool(settings.VERIFACTU_ENABLED)
    company_enabled = bool(fiscal_settings and fiscal_settings.enabled)
    enabled = global_enabled and company_enabled
    certificate_ready = certificate_configured(fiscal_settings)
    producer_ready = bool(
        settings.VERIFACTU_SOFTWARE_PRODUCER_NAME
        and settings.VERIFACTU_SOFTWARE_PRODUCER_TAX_ID
    )
    schema_path = (
        Path(__file__).resolve().parent.parent
        / "integrations"
        / "aeat"
        / "schemas"
        / "SuministroLR.xsd"
    )
    schemas_ready = schema_path.is_file()
    missing_fields = []
    if not settings.VERIFACTU_ENABLED:
        missing_fields.append("VERIFACTU_ENABLED")
    if not fiscal_settings or not fiscal_settings.enabled:
        missing_fields.append("company fiscal activation")
    if not certificate_ready:
        missing_fields.append("company certificate")
    if not producer_ready:
        missing_fields.append("software producer identity")
    if not schemas_ready:
        missing_fields.append("official AEAT schemas")

    return {
        "enabled": enabled,
        "global_enabled": global_enabled,
        "company_enabled": company_enabled,
        "environment": environment,
        "quarterly_vat_enabled": bool(
            fiscal_settings and fiscal_settings.quarterly_vat_enabled
        ),
        "quarterly_withholding_enabled": bool(
            fiscal_settings and fiscal_settings.quarterly_withholding_enabled
        ),
        "fiscal_reminder_days": (
            fiscal_settings.fiscal_reminder_days if fiscal_settings else 7
        ),
        "certificate_configured": certificate_ready,
        "certificate_uploaded_at": (
            fiscal_settings.certificate_uploaded_at if fiscal_settings else None
        ),
        "producer_configured": producer_ready,
        "official_schemas_available": schemas_ready,
        "submission_available": (
            enabled and certificate_ready and producer_ready and schemas_ready
        ),
        "endpoint": aeat_endpoint(environment),
        "missing_fields": missing_fields,
    }


def get_readiness(db: Session, company_id: int) -> dict:
    fiscal_settings = (
        db.query(CompanyFiscalSettings)
        .filter(CompanyFiscalSettings.company_id == company_id)
        .first()
    )
    return readiness_payload(fiscal_settings)


@contextmanager
def submission_credentials(
    db: Session,
    company_id: int,
) -> Iterator[tuple[str, str, str]]:
    fiscal_settings = (
        db.query(CompanyFiscalSettings)
        .filter(CompanyFiscalSettings.company_id == company_id)
        .first()
    )
    readiness = readiness_payload(fiscal_settings)
    if not readiness["submission_available"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VERI*FACTU company certificate or software producer identity is not configured",
        )
    assert fiscal_settings is not None
    certificate_password = decrypt_password(
        fiscal_settings.certificate_password_encrypted
    )
    if not certificate_password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VERI*FACTU company certificate is not configured",
        )
    if fiscal_settings.certificate_storage_key:
        try:
            certificate = get_object_storage().get(
                fiscal_settings.certificate_storage_key
            ).contents
        except ObjectNotFoundError as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="VERI*FACTU company certificate is not configured",
            ) from error
        descriptor, temporary_name = tempfile.mkstemp(prefix="workhive-verifactu-", suffix=".p12")
        try:
            os.write(descriptor, certificate)
            os.close(descriptor)
            descriptor = None
            Path(temporary_name).chmod(0o600)
            yield temporary_name, certificate_password, readiness["environment"]
        finally:
            if descriptor is not None:
                os.close(descriptor)
            Path(temporary_name).unlink(missing_ok=True)
        return
    if not fiscal_settings.certificate_path:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VERI*FACTU company certificate is not configured",
        )
    yield (
        fiscal_settings.certificate_path,
        certificate_password,
        readiness["environment"],
    )
