"""Resolve the global Facturae signer without exposing its private material."""

import base64
import binascii
import json
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.core.config import settings


class FacturaeSigningCredentialsError(RuntimeError):
    """The configured signing source cannot safely provide credentials."""


def signing_certificate_is_configured() -> bool:
    """Report configuration only; never fetch a secret during a read request."""
    if settings.FACTURAE_CERTIFICATE_SECRET_ID:
        return True
    certificate_path = settings.facturae_certificate_path
    return bool(
        certificate_path
        and settings.facturae_certificate_password
        and Path(certificate_path).expanduser().is_file()
    )


def _secrets_manager_client():
    try:
        import boto3
    except ImportError as error:
        raise FacturaeSigningCredentialsError(
            "Facturae signing secret support is unavailable"
        ) from error
    return boto3.client(
        "secretsmanager",
        region_name=(settings.FACTURAE_CERTIFICATE_SECRET_REGION or settings.S3_REGION),
    )


def _secret_credentials() -> tuple[bytes, str]:
    secret_id = settings.FACTURAE_CERTIFICATE_SECRET_ID
    if not secret_id:
        raise FacturaeSigningCredentialsError(
            "Facturae signing secret is not configured"
        )
    try:
        response = _secrets_manager_client().get_secret_value(SecretId=secret_id)
        encoded_payload = response.get("SecretString")
        payload = (
            json.loads(encoded_payload) if isinstance(encoded_payload, str) else None
        )
        certificate_b64 = (
            payload.get("pkcs12_base64") if isinstance(payload, dict) else None
        )
        password = payload.get("password") if isinstance(payload, dict) else None
        if (
            not isinstance(certificate_b64, str)
            or not isinstance(password, str)
            or not password
        ):
            raise ValueError("secret shape is invalid")
        certificate = base64.b64decode(certificate_b64, validate=True)
        if not certificate:
            raise ValueError("certificate is empty")
        return certificate, password
    except (binascii.Error, json.JSONDecodeError, TypeError, ValueError) as error:
        raise FacturaeSigningCredentialsError(
            "Facturae signing secret has an invalid format"
        ) from error
    except Exception as error:
        raise FacturaeSigningCredentialsError(
            "Facturae signing secret cannot be loaded"
        ) from error


@contextmanager
def facturae_signing_credentials() -> Iterator[tuple[str, str]]:
    """Yield a short-lived protected certificate path and never log its value."""
    if not settings.FACTURAE_CERTIFICATE_SECRET_ID:
        certificate_path = settings.facturae_certificate_path
        certificate_password = settings.facturae_certificate_password
        if (
            not certificate_path
            or not certificate_password
            or not Path(certificate_path).expanduser().is_file()
        ):
            raise FacturaeSigningCredentialsError(
                "Facturae signing certificate is not configured"
            )
        yield certificate_path, certificate_password
        return

    certificate, certificate_password = _secret_credentials()
    descriptor, temporary_name = tempfile.mkstemp(
        prefix="workhive-facturae-",
        suffix=".p12",
    )
    try:
        with os.fdopen(descriptor, "wb") as temporary_file:
            temporary_file.write(certificate)
        descriptor = None
        temporary = Path(temporary_name)
        temporary.chmod(0o600)
        yield temporary_name, certificate_password
    finally:
        if descriptor is not None:
            os.close(descriptor)
        Path(temporary_name).unlink(missing_ok=True)
