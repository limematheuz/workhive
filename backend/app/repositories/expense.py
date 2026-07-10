from datetime import datetime

from sqlalchemy.orm import Session

from app.models.expense import Expense


def get_expenses(
    db: Session,
    company_id: int,
    category: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Expense]:
    query = db.query(Expense).filter(
        Expense.company_id == company_id,
        Expense.is_active == True,
    )
    if category:
        query = query.filter(Expense.category == category)
    if date_from:
        query = query.filter(Expense.expense_date >= date_from)
    if date_to:
        query = query.filter(Expense.expense_date <= date_to)
    return query.order_by(Expense.expense_date.desc(), Expense.id.desc()).offset(skip).limit(limit).all()


def get_expense(db: Session, company_id: int, expense_id: int) -> Expense | None:
    return (
        db.query(Expense)
        .filter(
            Expense.id == expense_id,
            Expense.company_id == company_id,
            Expense.is_active == True,
        )
        .first()
    )


def create_expense(
    db: Session,
    company_id: int,
    created_by_user_id: int | None,
    **data,
) -> Expense:
    expense = Expense(
        company_id=company_id,
        created_by_user_id=created_by_user_id,
        **data,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def update_expense(db: Session, expense: Expense, **data) -> Expense:
    for key, value in data.items():
        setattr(expense, key, value)
    db.commit()
    db.refresh(expense)
    return expense


def delete_expense(db: Session, expense: Expense) -> None:
    expense.is_active = False
    db.commit()
