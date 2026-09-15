"""Financial margin forecasts for explicitly traced operational scopes."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import ActiveFinanceManager, ActiveFinanceReader, get_db
from app.models.user import User
from app.schemas.margin_forecast import (
    LocationMarginResponse,
    MarginForecastResponse,
    MarginForecastUpsert,
    ServiceMarginResponse,
    ServiceMarginScopeResponse,
    TeamLaborCostResponse,
)
from app.services import (
    audit_service,
    margin_forecast_service,
    team_labor_cost_reporting_service,
)


router = APIRouter()


@router.get("/teams", response_model=list[TeamLaborCostResponse])
def read_team_labor_costs(
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceReader,
):
    return team_labor_cost_reporting_service.list_team_labor_costs(db, current_user)


@router.get("/services", response_model=list[ServiceMarginScopeResponse])
def read_service_margin_scopes(
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceReader,
):
    return margin_forecast_service.list_service_margin_scopes(db, current_user)


@router.get("/services/{service_catalog_version_id}", response_model=ServiceMarginResponse)
def read_service_margin(
    service_catalog_version_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceReader,
):
    return margin_forecast_service.get_service_margin(
        db, current_user, service_catalog_version_id
    )


@router.get("/locations/{location_id}", response_model=LocationMarginResponse)
def read_location_margin(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceReader,
):
    return margin_forecast_service.get_location_margin(db, current_user, location_id)


@router.get("/contracts/{contract_id}", response_model=MarginForecastResponse)
def read_contract_margin_forecast(
    contract_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceReader,
):
    return margin_forecast_service.get_contract_margin_forecast(
        db, current_user, contract_id
    )


@router.put("/contracts/{contract_id}", response_model=MarginForecastResponse)
def save_contract_margin_forecast(
    contract_id: int,
    payload: MarginForecastUpsert,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    forecast = margin_forecast_service.upsert_contract_margin_forecast(
        db, current_user, contract_id, payload
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="margin_forecast.contract_saved",
        entity_type="service_contract",
        entity_id=contract_id,
        request=request,
        details={"planned_direct_cost_amount": str(payload.planned_direct_cost_amount)},
    )
    return forecast


@router.get("/work-orders/{work_order_id}", response_model=MarginForecastResponse)
def read_work_order_margin_forecast(
    work_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceReader,
):
    return margin_forecast_service.get_work_order_margin_forecast(
        db, current_user, work_order_id
    )


@router.put("/work-orders/{work_order_id}", response_model=MarginForecastResponse)
def save_work_order_margin_forecast(
    work_order_id: int,
    payload: MarginForecastUpsert,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    forecast = margin_forecast_service.upsert_work_order_margin_forecast(
        db, current_user, work_order_id, payload
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="margin_forecast.work_order_saved",
        entity_type="work_order",
        entity_id=work_order_id,
        request=request,
        details={"planned_direct_cost_amount": str(payload.planned_direct_cost_amount)},
    )
    return forecast
