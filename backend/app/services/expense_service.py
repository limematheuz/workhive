from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import expense as expense_repo
from app.repositories import inventory_purchase as inventory_purchase_repo
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


def _validate_client_assignment(
    db: Session,
    company_id: int,
    client_id: int | None,
) -> None:
    """Ensure an attributed cost belongs to the same tenant as the expense."""
    if client_id is not None:
        client_service.get_client(db, company_id, client_id)


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
    expense = _get_expense_or_404(db, company_id, expense_id)
    _reject_purchase_managed_expense(db, company_id, expense_id)
    payload = data.model_dump(exclude_unset=True)
    if "client_id" in payload:
        _validate_client_assignment(db, company_id, payload["client_id"])
    base_amount = payload.get("base_amount", expense.base_amount)
    tax_amount = payload.get("tax_amount", expense.tax_amount)
    if "base_amount" in payload or "tax_amount" in payload:
        payload["total_amount"] = _calculate_total(base_amount, tax_amount)
    return expense_repo.update_expense(db, expense, **payload)


def delete_expense(db: Session, company_id: int, expense_id: int) -> None:
    expense = _get_expense_or_404(db, company_id, expense_id)
    _reject_purchase_managed_expense(db, company_id, expense_id)
    expense_repo.delete_expense(db, expense)
