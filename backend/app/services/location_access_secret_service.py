import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import settings


def _fernet() -> Fernet:
    configured = settings.LOCATION_ACCESS_ENCRYPTION_KEY
    if configured:
        try:
            return Fernet(configured.encode("ascii"))
        except (TypeError, ValueError) as exc:
            raise ValueError(
                "LOCATION_ACCESS_ENCRYPTION_KEY must be a valid Fernet key"
            ) from exc
    fallback = base64.urlsafe_b64encode(
        hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    )
    return Fernet(fallback)


def encrypt_access_code(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")
