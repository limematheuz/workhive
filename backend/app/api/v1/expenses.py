from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import (
    ActiveApplicationUser,
    ActiveFinanceManager,
    ActiveUser,
    AsyncActiveFinancialReader,
    get_async_db,
    get_db,
)
from app.api.pagination import PaginationLimit, PaginationOffset
from app.models.user import User
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.schemas.expense import ExpenseCreate, ExpenseResponse, ExpenseUpdate
from app.services import expense_receipt_service, expense_service
from app.services.user_scope import is_platform_superadmin


router = APIRouter()


def _require_company_admin(current_user: User) -> None:
    if is_platform_superadmin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company admin required",
        )


@router.get("/", response_model=list[ExpenseResponse])
async def read_expenses(
    category: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    _require_company_admin(current_user)
    return await db.run_sync(
        lambda sync_db: expense_service.get_expenses(
            sync_db,
            current_user.company_id,
            category=category,
            date_from=date_from,
            date_to=date_to,
            skip=skip,
            limit=limit,
        )
    )


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def read_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    _require_company_admin(current_user)
    return await db.run_sync(
        lambda sync_db: expense_service.get_expense(
            sync_db,
            current_user.company_id,
            expense_id,
        )
    )


@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    expense_data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
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
    current_user: User = ActiveFinanceManager,
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
    current_user: User = ActiveFinanceManager,
):
    _require_company_admin(current_user)
    expense_service.delete_expense(db, current_user.company_id, expense_id)


@router.post("/{expense_id}/receipt", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def upload_expense_receipt(
    expense_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    _require_company_admin(current_user)
    enforce_rate_limit(
        request,
        "expense-receipt-upload",
        settings.MEDIA_UPLOAD_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(current_user.id),
    )
    return expense_receipt_service.upload_receipt(
        db,
        user=current_user,
        expense_id=expense_id,
        contents=file.file.read(expense_receipt_service.MAX_RECEIPT_BYTES + 1),
        content_type=file.content_type,
    )


@router.get("/{expense_id}/receipt")
def download_expense_receipt(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    _require_company_admin(current_user)
    stored, filename = expense_receipt_service.download_receipt(
        db, user=current_user, expense_id=expense_id
    )
    return Response(
        content=stored.contents,
        media_type=stored.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox",
        },
    )
