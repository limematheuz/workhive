"""Calendar-day expiry rules shared by inventory and work-order consumption."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException

WARNING_DAYS = 30


def inventory_today() -> date:
    # Inventory dates use the same calendar as the inventory UI.
    return datetime.now(ZoneInfo("Europe/Madrid")).date()


def expiry_status(expires_at: date | None, *, today: date | None = None) -> str:
    if expires_at is None:
        return "undated"
    remaining = (expires_at - (today or inventory_today())).days
    if remaining < 0:
        return "expired"
    return "expiring" if remaining <= WARNING_DAYS else "valid"


def require_usable_lot(lot, *, today: date | None = None) -> None:
    if lot is not None and expiry_status(lot.expires_at, today=today) == "expired":
        raise HTTPException(
            status_code=409,
            detail="El lote está caducado y no se puede utilizar en salidas ni consumos. Registra una devolución o baja con motivo.",
            headers={"X-WorkHive-Error-Code": "inventory.lot_expired"},
        )


def require_movement_expiry_policy(lot, payload) -> None:
    if payload.movement_type == "issue":
        require_usable_lot(lot)
    elif lot is not None and expiry_status(lot.expires_at) == "expired":
        if not ((payload.notes or "").strip() or (payload.reference or "").strip()):
            raise HTTPException(
                status_code=422,
                detail="Indica el motivo de la devolución, corrección o baja del lote caducado.",
                headers={"X-WorkHive-Error-Code": "inventory.expired_lot_reason_required"},
            )
