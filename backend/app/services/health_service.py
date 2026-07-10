import os
import tempfile
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.storage_service import get_object_storage


def readiness_checks(db: Session) -> dict[str, dict[str, str]]:
    checks: dict[str, dict[str, str]] = {}
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception:
        checks["database"] = {"status": "error"}

    descriptor = None
    temporary_name = None
    try:
        storage = Path(settings.INVOICE_PDF_STORAGE_PATH).expanduser().resolve()
        storage.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=".health-",
            dir=storage,
        )
        os.write(descriptor, b"ok")
        checks["invoice_storage"] = {"status": "ok"}
    except Exception:
        checks["invoice_storage"] = {"status": "error"}
    finally:
        if descriptor is not None:
            os.close(descriptor)
        if temporary_name:
            Path(temporary_name).unlink(missing_ok=True)

    try:
        get_object_storage().check()
        checks["media_storage"] = {"status": "ok"}
    except Exception:
        checks["media_storage"] = {"status": "error"}
    return checks
