from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import expense as expense_repo
from app.repositories import inventory_purchase as inventory_purchase_repo
from app.repositories import location as location_repo
from app.repositories import service_contract as service_contract_repo
from app.repositories import work_order as work_order_repo
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from app.services import client_service


def _calculate_total(base_amount: float, tax_amount: float) -> float:
    return round((base_amount or 0.0) + (tax_amount or 0.0), 2)


def _get_expense_or_404(db: Session, company_id: int, expense_id: int):
    expense = expense_repo.get_expense(db, company_id, expense_id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found",
        )
    return expense


def _reject_purchase_managed_expense(db: Session, company_id: int, expense_id: int) -> None:
    purchase = inventory_purchase_repo.get_purchase_by_expense(
        db, company_id=company_id, expense_id=expense_id
    )
    if purchase is not None and purchase.status == "received":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este gasto procede de una compra de material. Corrige la compra para conservar el stock coherente.",
            headers={"X-WorkHive-Error-Code": "inventory.purchase_managed_expense"},
        )


def require_mutable_expense(db: Session, company_id: int, expense_id: int):
    expense = _get_expense_or_404(db, company_id, expense_id)
    _reject_purchase_managed_expense(db, company_id, expense_id)
    return expense


def _reject_private_receipt_reference(payload: dict) -> None:
    reference = payload.get("receipt_url")
    if isinstance(reference, str) and reference.startswith("private-expense-receipt:"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Los justificantes privados se suben desde la acción del gasto",
        )


def _validate_client_assignment(
    db: Session,
    company_id: int,
    client_id: int | None,
) -> None:
    """Ensure an attributed cost belongs to the same tenant as the expense."""
    if client_id is not None:
        client_service.get_client(db, company_id, client_id)


def _resolve_operational_scope_client_id(
    db: Session,
    *,
    company_id: int,
    service_contract_id: int | None,
    work_order_id: int | None,
    requested_client_id: int | None,
) -> int | None:
    """Validate a direct-cost scope and keep its client attribution coherent."""
    if service_contract_id is not None and work_order_id is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Un gasto solo puede imputarse a un contrato o a una orden",
        )
    scope_client_id: int | None = None
    if service_contract_id is not None:
        contract = service_contract_repo.get_contract(
            db, company_id, service_contract_id
        )
        if contract is None:
            raise HTTPException(status_code=404, detail="Contrato no encontrado")
        scope_client_id = contract.client_id
    elif work_order_id is not None:
        work_order = work_order_repo.get_work_order(
            db, company_id=company_id, work_order_id=work_order_id
        )
        if work_order is None:
            raise HTTPException(status_code=404, detail="Orden no encontrada")
        location = location_repo.get_location_by_id(
            db, work_order.location_id, company_id
        )
        if location is None:
            raise HTTPException(status_code=404, detail="Ubicación no encontrada")
        scope_client_id = location.client_id

    if scope_client_id is None:
        if (service_contract_id is not None or work_order_id is not None) and requested_client_id is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="El alcance operativo no tiene un cliente compatible",
            )
        return requested_client_id
    if requested_client_id is not None and requested_client_id != scope_client_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El cliente debe coincidir con el contrato o la orden imputados",
        )
    return scope_client_id


def get_expenses(
    db: Session,
    company_id: int,
    category: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    skip: int = 0,
    limit: int = 100,
):
    return expense_repo.get_expenses(
        db,
        company_id=company_id,
        category=category,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )


def get_expense(db: Session, company_id: int, expense_id: int):
    return _get_expense_or_404(db, company_id, expense_id)


def create_expense(
    db: Session,
    company_id: int,
    created_by_user_id: int | None,
    data: ExpenseCreate,
):
    payload = data.model_dump()
    _reject_private_receipt_reference(payload)
    payload["client_id"] = _resolve_operational_scope_client_id(
        db,
        company_id=company_id,
        service_contract_id=payload["service_contract_id"],
        work_order_id=payload["work_order_id"],
        requested_client_id=payload["client_id"],
    )
    _validate_client_assignment(db, company_id, payload["client_id"])
    payload["total_amount"] = _calculate_total(
        payload["base_amount"],
        payload["tax_amount"],
    )
    return expense_repo.create_expense(
        db,
        company_id=company_id,
        created_by_user_id=created_by_user_id,
        **payload,
    )


def update_expense(
    db: Session,
    company_id: int,
    expense_id: int,
    data: ExpenseUpdate,
):
    expense = require_mutable_expense(db, company_id, expense_id)
    payload = data.model_dump(exclude_unset=True)
    _reject_private_receipt_reference(payload)
    next_service_contract_id = payload.get(
        "service_contract_id", expense.service_contract_id
    )
    next_work_order_id = payload.get("work_order_id", expense.work_order_id)
    next_client_id = payload.get("client_id", expense.client_id)
    resolved_client_id = _resolve_operational_scope_client_id(
        db,
        company_id=company_id,
        service_contract_id=next_service_contract_id,
        work_order_id=next_work_order_id,
        requested_client_id=next_client_id,
    )
    if (
        "client_id" in payload
        or "service_contract_id" in payload
        or "work_order_id" in payload
        or resolved_client_id != expense.client_id
    ):
        payload["client_id"] = resolved_client_id
    _validate_client_assignment(db, company_id, resolved_client_id)
    base_amount = payload.get("base_amount", expense.base_amount)
    tax_amount = payload.get("tax_amount", expense.tax_amount)
    if "base_amount" in payload or "tax_amount" in payload:
        payload["total_amount"] = _calculate_total(base_amount, tax_amount)
    return expense_repo.update_expense(db, expense, **payload)


def delete_expense(db: Session, company_id: int, expense_id: int) -> None:
    expense = require_mutable_expense(db, company_id, expense_id)
    expense_repo.delete_expense(db, expense)
