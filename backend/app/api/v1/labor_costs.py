from datetime import date

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.models.user import User
from app.schemas.labor_cost import (
    LaborCostRateCreate,
    LaborCostRateResponse,
    LaborCostSummaryResponse,
)
from app.services import audit_service, labor_cost_service


router = APIRouter()


@router.get("/rates", response_model=list[LaborCostRateResponse])
def read_labor_cost_rates(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return labor_cost_service.list_rates(db, current_user)


@router.post(
    "/rates",
    response_model=LaborCostRateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_labor_cost_rate(
    payload: LaborCostRateCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    rate = labor_cost_service.create_rate(db, current_user, payload)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=rate.company_id,
        action="labor_cost_rate.created",
        entity_type="labor_cost_rate",
        entity_id=rate.id,
        request=request,
        details={
            "company_membership_id": rate.company_membership_id,
            "effective_on": rate.effective_on.isoformat(),
        },
    )
    return rate


@router.get("/summary", response_model=list[LaborCostSummaryResponse])
def read_labor_cost_summary(
    start_on: date | None = None,
    end_on: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return labor_cost_service.list_summaries(
        db,
        current_user,
        start_on=start_on,
        end_on=end_on,
    )
