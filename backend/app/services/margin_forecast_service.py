"""Scope-safe planned-versus-traced margin calculations."""

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import margin_forecast as forecast_repo
from app.repositories import location as location_repo
from app.repositories import service_contract as service_contract_repo
from app.repositories import work_order as work_order_repo
from app.schemas.margin_forecast import (
    MarginForecastBudgetResponse,
    MarginForecastResponse,
    MarginForecastUpsert,
    LocationMarginResponse,
    ServiceMarginResponse,
    ServiceMarginScopeResponse,
)
from app.services.margin_reporting_policy import (
    money as _money,
    require_margin_manage_access as _require_manage_access,
    require_margin_read_access as _require_read_access,
)


ZERO = Decimal("0")


def _contract_or_404(db: Session, company_id: int, contract_id: int):
    contract = service_contract_repo.get_contract(db, company_id, contract_id)
    if contract is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contrato no encontrado")
    return contract


def _work_order_or_404(db: Session, company_id: int, work_order_id: int):
    work_order = work_order_repo.get_work_order(
        db, company_id=company_id, work_order_id=work_order_id
    )
    if work_order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")
    return work_order


def _contract_planned_revenue(contract) -> Decimal | None:
    value = contract.quote_snapshot.get("base_amount") if contract.quote_snapshot else None
    try:
        return _money(value) if value is not None else None
    except (TypeError, ValueError, ArithmeticError):
        return None


def _response(
    *,
    scope_type: str,
    scope_id: int,
    scope_name: str,
    budget,
    planned_revenue: Decimal | None,
    work_order_ids: list[int],
    service_contract_id: int | None,
    db: Session,
    company_id: int,
) -> MarginForecastResponse:
    labor_cost, material_cost, actual_revenue, direct_expense_cost = forecast_repo.actual_totals_for_work_orders(
        db,
        company_id=company_id,
        work_order_ids=work_order_ids,
        service_contract_id=service_contract_id,
    )
    planned_cost = _money(budget.planned_direct_cost_amount) if budget else None
    actual_labor_cost = _money(labor_cost)
    actual_material_cost = _money(material_cost)
    actual_expense_cost = _money(direct_expense_cost)
    actual_direct_cost = _money(
        actual_labor_cost + actual_material_cost + actual_expense_cost
    )
    actual_revenue = _money(actual_revenue)
    return MarginForecastResponse(
        scope_type=scope_type,
        scope_id=scope_id,
        scope_name=scope_name,
        budget=(
            MarginForecastBudgetResponse.model_validate(budget)
            if budget is not None
            else None
        ),
        planned_revenue_base_amount=planned_revenue,
        planned_direct_cost_base_amount=planned_cost,
        planned_margin_base_amount=(
            _money(planned_revenue - planned_cost)
            if planned_revenue is not None and planned_cost is not None
            else None
        ),
        actual_revenue_base_amount=actual_revenue,
        actual_labor_cost_base_amount=actual_labor_cost,
        actual_material_cost_base_amount=actual_material_cost,
        actual_expense_cost_base_amount=actual_expense_cost,
        actual_direct_cost_base_amount=actual_direct_cost,
        actual_margin_base_amount=_money(actual_revenue - actual_direct_cost),
        direct_cost_variance_base_amount=(
            _money(actual_direct_cost - planned_cost)
            if planned_cost is not None
            else None
        ),
    )


def get_contract_margin_forecast(
    db: Session, current_user: User, contract_id: int
) -> MarginForecastResponse:
    company_id = _require_read_access(db, current_user)
    contract = _contract_or_404(db, company_id, contract_id)
    return _response(
        scope_type="contract",
        scope_id=contract.id,
        scope_name=contract.title,
        budget=forecast_repo.get_contract_forecast(
            db, company_id=company_id, contract_id=contract.id
        ),
        planned_revenue=_contract_planned_revenue(contract),
        work_order_ids=forecast_repo.list_contract_work_order_ids(
            db, company_id=company_id, contract_id=contract.id
        ),
        service_contract_id=contract.id,
        db=db,
        company_id=company_id,
    )


def get_work_order_margin_forecast(
    db: Session, current_user: User, work_order_id: int
) -> MarginForecastResponse:
    company_id = _require_read_access(db, current_user)
    work_order = _work_order_or_404(db, company_id, work_order_id)
    return _response(
        scope_type="work_order",
        scope_id=work_order.id,
        scope_name=work_order.title,
        budget=forecast_repo.get_work_order_forecast(
            db, company_id=company_id, work_order_id=work_order.id
        ),
        # Contract revenue belongs to its agreement as a whole.  A single
        # order is not allocated a made-up share of that commercial amount.
        planned_revenue=None,
        work_order_ids=[work_order.id],
        service_contract_id=None,
        db=db,
        company_id=company_id,
    )


def get_location_margin(
    db: Session, current_user: User, location_id: int
) -> LocationMarginResponse:
    company_id = _require_read_access(db, current_user)
    location = location_repo.get_location_by_id(db, location_id, company_id)
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ubicación no encontrada")
    labor_cost, material_cost, actual_revenue, direct_expense_cost = (
        forecast_repo.actual_totals_for_location(
            db, company_id=company_id, location_id=location.id
        )
    )
    actual_labor_cost = _money(labor_cost)
    actual_material_cost = _money(material_cost)
    actual_expense_cost = _money(direct_expense_cost)
    actual_direct_cost = _money(
        actual_labor_cost + actual_material_cost + actual_expense_cost
    )
    actual_revenue = _money(actual_revenue)
    return LocationMarginResponse(
        scope_type="location",
        scope_id=location.id,
        scope_name=location.name,
        actual_revenue_base_amount=actual_revenue,
        actual_labor_cost_base_amount=actual_labor_cost,
        actual_material_cost_base_amount=actual_material_cost,
        actual_expense_cost_base_amount=actual_expense_cost,
        actual_direct_cost_base_amount=actual_direct_cost,
        actual_margin_base_amount=_money(actual_revenue - actual_direct_cost),
    )


def list_service_margin_scopes(
    db: Session, current_user: User
) -> list[ServiceMarginScopeResponse]:
    company_id = _require_read_access(db, current_user)
    return [
        ServiceMarginScopeResponse(
            id=service.id,
            name=service.name,
            version=service.version,
        )
        for service in forecast_repo.list_service_margin_scopes(
            db, company_id=company_id
        )
    ]


def get_service_margin(
    db: Session, current_user: User, service_catalog_version_id: int
) -> ServiceMarginResponse:
    company_id = _require_read_access(db, current_user)
    service = forecast_repo.get_service_margin_scope(
        db,
        company_id=company_id,
        service_catalog_version_id=service_catalog_version_id,
    )
    if service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Servicio no encontrado")
    labor_cost, actual_revenue = forecast_repo.known_totals_for_service(
        db,
        company_id=company_id,
        service_catalog_version_id=service.id,
    )
    actual_labor_cost = _money(labor_cost)
    actual_revenue = _money(actual_revenue)
    return ServiceMarginResponse(
        scope_type="service",
        scope_id=service.id,
        scope_name=f"{service.name} · v{service.version}",
        actual_revenue_base_amount=actual_revenue,
        actual_labor_cost_base_amount=actual_labor_cost,
        known_direct_cost_base_amount=actual_labor_cost,
        known_margin_base_amount=_money(actual_revenue - actual_labor_cost),
    )


def _upsert(
    db: Session,
    *,
    company_id: int,
    actor_user_id: int,
    existing,
    scope_values: dict[str, int],
    payload: MarginForecastUpsert,
):
    values = payload.model_dump()
    values["notes"] = values["notes"] or None
    if existing is None:
        return forecast_repo.create_forecast(
            db,
            company_id=company_id,
            created_by_user_id=actor_user_id,
            updated_by_user_id=actor_user_id,
            **scope_values,
            **values,
        )
    return forecast_repo.update_forecast(
        db,
        existing,
        updated_by_user_id=actor_user_id,
        **values,
    )


def upsert_contract_margin_forecast(
    db: Session,
    current_user: User,
    contract_id: int,
    payload: MarginForecastUpsert,
) -> MarginForecastResponse:
    company_id = _require_manage_access(db, current_user)
    contract = _contract_or_404(db, company_id, contract_id)
    try:
        _upsert(
            db,
            company_id=company_id,
            actor_user_id=current_user.id,
            existing=forecast_repo.get_contract_forecast(
                db, company_id=company_id, contract_id=contract.id, for_update=True
            ),
            scope_values={"service_contract_id": contract.id},
            payload=payload,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El presupuesto de coste se ha actualizado; vuelve a intentarlo",
        ) from None
    except Exception:
        db.rollback()
        raise
    return get_contract_margin_forecast(db, current_user, contract.id)


def upsert_work_order_margin_forecast(
    db: Session,
    current_user: User,
    work_order_id: int,
    payload: MarginForecastUpsert,
) -> MarginForecastResponse:
    company_id = _require_manage_access(db, current_user)
    work_order = _work_order_or_404(db, company_id, work_order_id)
    try:
        _upsert(
            db,
            company_id=company_id,
            actor_user_id=current_user.id,
            existing=forecast_repo.get_work_order_forecast(
                db, company_id=company_id, work_order_id=work_order.id, for_update=True
            ),
            scope_values={"work_order_id": work_order.id},
            payload=payload,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El presupuesto de coste se ha actualizado; vuelve a intentarlo",
        ) from None
    except Exception:
        db.rollback()
        raise
    return get_work_order_margin_forecast(db, current_user, work_order.id)
