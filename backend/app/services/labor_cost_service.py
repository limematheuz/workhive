from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.labor_cost_rate import LaborCostRate
from app.models.user import User
from app.repositories import labor_cost as labor_cost_repo
from app.repositories import organization as organization_repo
from app.schemas.labor_cost import LaborCostRateCreate, LaborCostSummaryResponse
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context


def _require_read_access(db: Session, current_user: User) -> int:
    company_id = require_company_context(current_user)
    require_capability(db, current_user, "labor_costs.read")
    return company_id


def list_rates(db: Session, current_user: User) -> list[LaborCostRate]:
    return labor_cost_repo.list_rates(db, company_id=_require_read_access(db, current_user))


def create_rate(
    db: Session,
    current_user: User,
    payload: LaborCostRateCreate,
) -> LaborCostRate:
    company_id = require_company_context(current_user)
    require_capability(db, current_user, "labor_costs.manage")
    membership = organization_repo.get_company_membership(
        db,
        company_id=company_id,
        membership_id=payload.company_membership_id,
    )
    if membership is None or membership.status != "active":
        raise HTTPException(status_code=404, detail="Miembro activo no encontrado")
    if labor_cost_repo.has_rate_on_date(
        db,
        company_id=company_id,
        company_membership_id=membership.id,
        effective_on=payload.effective_on,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un coste interno para esa fecha",
        )
    rate = LaborCostRate(
        company_id=company_id,
        company_membership_id=membership.id,
        hourly_cost=payload.hourly_cost,
        effective_on=payload.effective_on,
        created_by_user_id=current_user.id,
    )
    db.add(rate)
    db.commit()
    return next(
        item
        for item in labor_cost_repo.list_rates(db, company_id=company_id)
        if item.id == rate.id
    )


def list_summaries(
    db: Session,
    current_user: User,
    *,
    start_on: date | None,
    end_on: date | None,
) -> list[LaborCostSummaryResponse]:
    company_id = _require_read_access(db, current_user)
    if start_on and end_on and end_on < start_on:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La fecha final no puede ser anterior a la inicial",
        )
    return [
        LaborCostSummaryResponse(
            user_id=user_id,
            member_name=member_name,
            session_count=session_count,
            total_cost=total_cost,
        )
        for user_id, member_name, session_count, total_cost in labor_cost_repo.list_cost_summaries(
            db,
            company_id=company_id,
            start_on=start_on,
            end_on=end_on,
        )
    ]
