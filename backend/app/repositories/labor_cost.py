from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.company_membership import CompanyMembership
from app.models.labor_cost_rate import LaborCostRate
from app.models.work_session import WorkSession
from app.models.user import User


def list_rates(db: Session, *, company_id: int) -> list[LaborCostRate]:
    return (
        db.query(LaborCostRate)
        .options(
            joinedload(LaborCostRate.company_membership).joinedload(
                CompanyMembership.user
            )
        )
        .filter(LaborCostRate.company_id == company_id)
        .order_by(
            LaborCostRate.company_membership_id.asc(),
            LaborCostRate.effective_on.desc(),
            LaborCostRate.id.desc(),
        )
        .all()
    )


def get_effective_rate(
    db: Session,
    *,
    company_id: int,
    company_membership_id: int,
    effective_on: date,
) -> LaborCostRate | None:
    return (
        db.query(LaborCostRate)
        .filter(
            LaborCostRate.company_id == company_id,
            LaborCostRate.company_membership_id == company_membership_id,
            LaborCostRate.effective_on <= effective_on,
        )
        .order_by(LaborCostRate.effective_on.desc(), LaborCostRate.id.desc())
        .first()
    )


def has_rate_on_date(
    db: Session,
    *,
    company_id: int,
    company_membership_id: int,
    effective_on: date,
) -> bool:
    return (
        db.query(LaborCostRate.id)
        .filter(
            LaborCostRate.company_id == company_id,
            LaborCostRate.company_membership_id == company_membership_id,
            LaborCostRate.effective_on == effective_on,
        )
        .first()
        is not None
    )


def list_cost_summaries(
    db: Session,
    *,
    company_id: int,
    start_on: date | None,
    end_on: date | None,
) -> list[tuple[int, str, int, Decimal]]:
    query = (
        db.query(
            WorkSession.user_id,
            User.full_name,
            User.email,
            func.coalesce(func.sum(WorkSession.labor_cost_amount_snapshot), 0),
            func.count(WorkSession.id),
        )
        .join(User, User.id == WorkSession.user_id)
        .filter(
            WorkSession.labor_cost_company_id == company_id,
            WorkSession.end_time.isnot(None),
            WorkSession.labor_cost_amount_snapshot.isnot(None),
        )
        .group_by(WorkSession.user_id, User.full_name, User.email)
        .order_by(User.full_name.asc(), User.email.asc())
    )
    if start_on is not None:
        query = query.filter(
            WorkSession.end_time >= datetime.combine(start_on, time.min, tzinfo=timezone.utc)
        )
    if end_on is not None:
        query = query.filter(
            WorkSession.end_time
            < datetime.combine(end_on + timedelta(days=1), time.min, tzinfo=timezone.utc)
        )
    return [
        (user_id, full_name or email, int(count), Decimal(str(total)))
        for user_id, full_name, email, total, count in query.all()
    ]
