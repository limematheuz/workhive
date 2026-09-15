"""Capture internal labour cost without exposing it to operational flows."""

from datetime import timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.work_session import WorkSession
from app.repositories import labor_cost as labor_cost_repo
from app.repositories import location as location_repo
from app.repositories import organization as organization_repo


MONEY_QUANTUM = Decimal("0.01")


def _worked_seconds(work_session: WorkSession) -> int:
    if work_session.end_time is None:
        return 0
    started_at = work_session.start_time
    ended_at = work_session.end_time
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    if ended_at.tzinfo is None:
        ended_at = ended_at.replace(tzinfo=timezone.utc)
    elapsed = max(0, int((ended_at - started_at).total_seconds()))
    return max(0, elapsed - max(0, int(work_session.paused_seconds or 0)))


def refresh_work_session_labor_cost(
    db: Session,
    *,
    work_session: WorkSession,
    company_id: int,
) -> None:
    """Set a durable cost snapshot after a session closes or is approved.

    Missing rate is represented as ``None`` rather than free work: it keeps
    incomplete configuration distinct from a deliberately configured 0 EUR
    internal hourly cost.
    """

    if work_session.end_time is None:
        return
    _capture_responsible_team_snapshot(
        db,
        work_session=work_session,
        company_id=company_id,
    )
    membership = organization_repo.get_user_membership(
        db,
        company_id=company_id,
        user_id=work_session.user_id,
    )
    if membership is None:
        work_session.labor_cost_company_id = None
        work_session.labor_cost_membership_id = None
        work_session.labor_cost_rate_snapshot = None
        work_session.labor_cost_amount_snapshot = None
        return
    rate = labor_cost_repo.get_effective_rate(
        db,
        company_id=company_id,
        company_membership_id=membership.id,
        effective_on=work_session.end_time.date(),
    )
    work_session.labor_cost_company_id = company_id
    work_session.labor_cost_membership_id = membership.id
    if rate is None:
        work_session.labor_cost_rate_snapshot = None
        work_session.labor_cost_amount_snapshot = None
        return
    hourly_cost = Decimal(rate.hourly_cost)
    amount = (
        hourly_cost * Decimal(_worked_seconds(work_session)) / Decimal(3600)
    ).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)
    work_session.labor_cost_rate_snapshot = hourly_cost
    work_session.labor_cost_amount_snapshot = amount


def _capture_responsible_team_snapshot(
    db: Session,
    *,
    work_session: WorkSession,
    company_id: int,
) -> None:
    """Freeze the team responsible for the session location at close time.

    Team memberships are many-to-many and can change over time, so they cannot
    safely identify one team for a completed session. Legacy closed sessions
    are deliberately marked as already snapshotted by the migration and stay
    unassigned instead of being backfilled from today's location settings.
    """
    if work_session.labor_cost_team_snapshotted_at is not None:
        return
    location = location_repo.get_location_by_id(
        db,
        work_session.location_id,
        company_id,
    )
    team = (
        organization_repo.get_team(
            db,
            company_id=company_id,
            team_id=location.team_id,
        )
        if location is not None and location.team_id is not None
        else None
    )
    work_session.labor_cost_team_id = team.id if team is not None else None
    work_session.labor_cost_team_name_snapshot = team.name if team is not None else None
    work_session.labor_cost_team_snapshotted_at = work_session.end_time
