"""Task pricing and immutable person-hour snapshots for invoicing.

Keeps fixed-price and hourly modes explicit. Economic amounts for task-linked
invoice lines are resolved here so the API client cannot invent hours or rates.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

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


def normalize_pricing_mode(value: str | None) -> str:
    mode = (value or PRICING_MODE_FIXED).strip().lower()
    if mode not in PRICING_MODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="pricing_mode must be 'fixed' or 'hourly'",
        )
    return mode


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

    Prefer the immutable snapshot. If an older completed task has none yet,
    derive hours from sessions and backfill the snapshot once.
    """
    reference = now or datetime.now(timezone.utc)
    workers = worker_hour_rows(sessions, now=reference)
    if task.worked_seconds_snapshot is not None:
        return int(task.worked_seconds_snapshot), workers

    seconds = sum_person_seconds(sessions, now=reference)
    if task.status == "completed":
        task.worked_seconds_snapshot = seconds
    return seconds, workers


def resolve_task_invoice_quantity_and_rate(
    task: TaskItem,
) -> tuple[Decimal, Decimal]:
    mode = normalize_pricing_mode(getattr(task, "pricing_mode", None))
    rate = Decimal(str(task.price or 0))

    if mode == PRICING_MODE_HOURLY:
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

    quantity = Decimal(str(task.quantity if task.quantity is not None else 1))
    if quantity <= 0:
        quantity = Decimal("1")
    return quantity, rate
