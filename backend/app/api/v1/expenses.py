from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveAdmin, get_db
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseResponse, ExpenseUpdate
from app.services import expense_service
from app.services.user_scope import is_platform_superadmin


router = APIRouter()


def _require_company_admin(current_user: User) -> None:
    if is_platform_superadmin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company admin required",
        )


@router.get("/", response_model=list[ExpenseResponse])
def read_expenses(
    category: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    _require_company_admin(current_user)
    return expense_service.get_expenses(
        db,
        current_user.company_id,
        category=category,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )


@router.get("/{expense_id}", response_model=ExpenseResponse)
def read_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    _require_company_admin(current_user)
    return expense_service.get_expense(db, current_user.company_id, expense_id)


@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    expense_data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    _require_company_admin(current_user)
    return expense_service.create_expense(
        db,
        current_user.company_id,
        current_user.id,
        expense_data,
    )


@router.patch("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    expense_data: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    _require_company_admin(current_user)
    return expense_service.update_expense(
        db,
        current_user.company_id,
        expense_id,
        expense_data,
    )


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    _require_company_admin(current_user)
    expense_service.delete_expense(db, current_user.company_id, expense_id)
