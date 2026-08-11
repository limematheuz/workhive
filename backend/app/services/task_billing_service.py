"""Task pricing and immutable person-hour snapshots for invoicing.

Keeps fixed-price and hourly modes explicit. Economic amounts for task-linked
invoice lines are resolved here so the API client cannot invent hours or rates.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Mapping

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.task_item import TaskItem
from app.models.work_session import WorkSession
from app.repositories import work_session as work_session_repo
from app.repositories.invoice_item import DETAIL_QUANTUM

PRICING_MODE_FIXED = "fixed"
PRICING_MODE_HOURLY = "hourly"
PRICING_MODES = frozenset({PRICING_MODE_FIXED, PRICING_MODE_HOURLY})

HOURS_QUANTUM = DETAIL_QUANTUM
PRICING_FIELDS = frozenset({"pricing_mode", "price", "quantity", "unit"})


def normalize_pricing_mode(value: str | None) -> str:
    mode = (value or PRICING_MODE_FIXED).strip().lower()
    if mode not in PRICING_MODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="pricing_mode must be 'fixed' or 'hourly'",
        )
    return mode


def _decimal(value: float | int | Decimal | None, *, default: Decimal) -> Decimal:
    if value is None:
        return default
    return Decimal(str(value))


def _pricing_terms(
    task: TaskItem,
    updates: Mapping[str, object] | None = None,
) -> tuple[str, float | None, float | None, str | None]:
    values: dict[str, object | None] = {
        "pricing_mode": task.pricing_mode,
        "price": task.price,
        "quantity": task.quantity,
        "unit": task.unit,
    }
    if updates:
        values.update({key: updates[key] for key in PRICING_FIELDS & updates.keys()})

    mode = normalize_pricing_mode(values["pricing_mode"] if isinstance(values["pricing_mode"], str) else None)
    price = values["price"]
    quantity = values["quantity"]
    unit = values["unit"]
    return (
        mode,
        float(price) if isinstance(price, (int, float, Decimal)) else None,
        float(quantity) if isinstance(quantity, (int, float, Decimal)) else None,
        str(unit).strip() if unit is not None else None,
    )


def validate_pricing_terms(
    mode: str,
    price: float | None,
    quantity: float | None,
    unit: str | None,
) -> tuple[float, float, str]:
    """Validate and normalize the commercial agreement before work starts."""
    normalized_mode = normalize_pricing_mode(mode)
    if price is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Set the agreed task price before work starts",
        )
    normalized_price = float(price)
    if normalized_mode == PRICING_MODE_HOURLY and normalized_price <= 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Hourly tasks need a positive hourly rate before work starts",
        )
    if normalized_mode == PRICING_MODE_FIXED and normalized_price < 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Fixed task prices cannot be negative",
        )

    normalized_quantity = float(quantity) if quantity is not None else 1.0
    if normalized_mode == PRICING_MODE_FIXED and normalized_quantity <= 0:
        normalized_quantity = 1.0
    normalized_unit = "hour" if normalized_mode == PRICING_MODE_HOURLY else (unit or "service")
    return normalized_price, normalized_quantity, normalized_unit


def pricing_is_locked(task: TaskItem) -> bool:
    return task.pricing_locked_at is not None


def task_has_agreed_pricing(task: TaskItem) -> bool:
    """Return whether a task has terms safe to turn into an invoice line.

    Tasks created before commercial terms were introduced may legitimately have
    no price. They must remain usable for operations, but cannot silently turn
    into a zero-value invoice line.
    """
    if pricing_is_locked(task):
        return task.billing_price_snapshot is not None
    return task.price is not None


def require_task_pricing_for_invoice(task: TaskItem) -> None:
    if not task_has_agreed_pricing(task):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Set the agreed task price before invoicing",
        )


def validate_pricing_update(
    task: TaskItem,
    updates: Mapping[str, object],
) -> None:
    """Reject changes to agreed commercial terms after the first work start."""
    if not pricing_is_locked(task):
        return

    for field in PRICING_FIELDS & updates.keys():
        proposed = updates[field]
        current = getattr(task, field)
        if field in {"price", "quantity"}:
            if _decimal(proposed if isinstance(proposed, (int, float, Decimal)) else None, default=Decimal("0")) != _decimal(current, default=Decimal("0")):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Pricing terms are locked because work has already started",
                )
        elif proposed != current:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Pricing terms are locked because work has already started",
            )


def lock_task_pricing(
    task: TaskItem,
    *,
    updates: Mapping[str, object] | None = None,
    locked_at: datetime | None = None,
) -> None:
    """Freeze the agreed economic terms when the first person starts work."""
    if pricing_is_locked(task):
        return

    mode, price, quantity, unit = _pricing_terms(task, updates)
    # Preserve operational continuity for tasks created before pricing terms
    # existed. New task and acceptance forms require an agreement, while this
    # legacy path remains non-billable until an administrator fills it in.
    if price is None:
        return
    price, quantity, unit = validate_pricing_terms(mode, price, quantity, unit)
    task.pricing_locked_at = locked_at or datetime.now(timezone.utc)
    task.billing_pricing_mode_snapshot = mode
    task.billing_price_snapshot = price
    task.billing_quantity_snapshot = quantity
    task.billing_unit_snapshot = unit


def resolve_invoice_pricing_terms(task: TaskItem) -> tuple[str, Decimal, Decimal, str]:
    """Return the commercial agreement used for invoice display and creation."""
    if pricing_is_locked(task):
        mode = normalize_pricing_mode(task.billing_pricing_mode_snapshot)
        price = _decimal(task.billing_price_snapshot, default=Decimal("0"))
        quantity = _decimal(task.billing_quantity_snapshot, default=Decimal("1"))
        unit = task.billing_unit_snapshot or "service"
    else:
        mode = normalize_pricing_mode(task.pricing_mode)
        price = _decimal(task.price, default=Decimal("0"))
        quantity = _decimal(task.quantity, default=Decimal("1"))
        unit = task.unit or "service"
    return mode, price, quantity, unit


def session_duration_seconds(
    work_session: WorkSession,
    *,
    now: datetime,
) -> int:
    start = work_session.start_time
    end = work_session.end_time or now
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return max(0, int((end - start).total_seconds()))


def sum_person_seconds(
    sessions: list[WorkSession],
    *,
    now: datetime | None = None,
) -> int:
    reference = now or datetime.now(timezone.utc)
    return sum(
        session_duration_seconds(session, now=reference) for session in sessions
    )


def billable_hours_from_seconds(seconds: int) -> Decimal:
    hours = Decimal(seconds) / Decimal(3600)
    return hours.quantize(HOURS_QUANTUM, rounding=ROUND_HALF_UP)


def close_active_task_sessions(
    db: Session,
    task_id: int,
    end_time: datetime,
) -> None:
    sessions = [
        session
        for session in work_session_repo.get_sessions_by_task(db, task_id)
        if session.end_time is None
    ]
    newest_by_user: dict[int, WorkSession] = {}
    for session in sorted(sessions, key=lambda item: item.id, reverse=True):
        if session.user_id not in newest_by_user:
            newest_by_user[session.user_id] = session
            session.end_time = end_time
        else:
            session.end_time = session.start_time
        db.add(session)


def capture_completed_work_snapshot(
    db: Session,
    task: TaskItem,
    *,
    completed_at: datetime | None = None,
) -> int:
    """Close open clocks and freeze person-hours on the task.

    The snapshot is the source of truth for hourly invoicing. Fixed-price tasks
    still receive it so operations and profitability stay auditable.
    """
    stamped_at = completed_at or datetime.now(timezone.utc)
    close_active_task_sessions(db, task.id, stamped_at)
    db.flush()
    sessions = work_session_repo.get_sessions_by_task(db, task.id)
    seconds = sum_person_seconds(sessions, now=stamped_at)
    task.worked_seconds_snapshot = seconds
    return seconds


def clear_work_snapshot_on_reopen(task: TaskItem) -> None:
    task.worked_seconds_snapshot = None


def resolved_worked_seconds(task: TaskItem) -> int:
    if task.worked_seconds_snapshot is not None:
        return int(task.worked_seconds_snapshot)
    return 0


def worker_hour_rows(
    sessions: list[WorkSession],
    *,
    now: datetime | None = None,
) -> list[dict[str, object]]:
    """Aggregate person-hours per worker for invoice/ops visibility."""
    reference = now or datetime.now(timezone.utc)
    by_user: dict[int, dict[str, object]] = {}
    for session in sessions:
        seconds = session_duration_seconds(session, now=reference)
        entry = by_user.get(session.user_id)
        if entry is None:
            user_name = (
                session.user.full_name or session.user.email
                if session.user
                else f"User {session.user_id}"
            )
            entry = {
                "user_id": session.user_id,
                "user_name": user_name or f"User {session.user_id}",
                "worked_seconds": 0,
            }
            by_user[session.user_id] = entry
        entry["worked_seconds"] = int(entry["worked_seconds"]) + seconds

    rows: list[dict[str, object]] = []
    for entry in sorted(by_user.values(), key=lambda item: str(item["user_name"]).lower()):
        seconds = int(entry["worked_seconds"])
        rows.append(
            {
                "user_id": entry["user_id"],
                "user_name": entry["user_name"],
                "worked_seconds": seconds,
                "worked_hours": float(billable_hours_from_seconds(seconds)),
            }
        )
    return rows


def resolve_invoiceable_work(
    task: TaskItem,
    sessions: list[WorkSession],
    *,
    now: datetime | None = None,
) -> tuple[int, list[dict[str, object]]]:
    """Return displayable person-hours and per-worker rows.

    Prefer the immutable snapshot. Older fixed-price tasks without a snapshot
    can still display their historic sessions, but reading invoice candidates
    must not mutate accounting data.
    """
    reference = now or datetime.now(timezone.utc)
    workers = worker_hour_rows(sessions, now=reference)
    if task.worked_seconds_snapshot is not None:
        return int(task.worked_seconds_snapshot), workers

    return sum_person_seconds(sessions, now=reference), workers


def resolve_task_invoice_quantity_and_rate(
    task: TaskItem,
) -> tuple[Decimal, Decimal]:
    require_task_pricing_for_invoice(task)
    mode, rate, fixed_quantity, _ = resolve_invoice_pricing_terms(task)

    if mode == PRICING_MODE_HOURLY:
        if rate <= 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Hourly tasks need a positive hourly rate before invoicing",
            )
        seconds = resolved_worked_seconds(task)
        if seconds <= 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Hourly tasks need recorded person-hours before invoicing. "
                    "Complete the work sessions and finish the task first."
                ),
            )
        quantity = billable_hours_from_seconds(seconds)
        if quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Hourly task billable hours must be greater than zero",
            )
        return quantity, rate

    quantity = fixed_quantity
    if quantity <= 0:
        quantity = Decimal("1")
    return quantity, rate
