"""Financial endpoints for manually reconciling bank statement entries."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import (
    ActiveFinanceManager,
    AsyncActiveFinancialReader,
    get_async_db,
    get_db,
)
from app.models.user import User
from app.schemas.bank_reconciliation import (
    BankReconciliationMatch,
    BankReconciliationReverse,
    BankStatementEntryCreate,
    BankStatementEntryResponse,
)
from app.services import audit_service, bank_reconciliation_service


router = APIRouter()


@router.get("/entries", response_model=list[BankStatementEntryResponse])
async def read_bank_statement_entries(
    entry_status: str | None = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    return await db.run_sync(
        lambda sync_db: bank_reconciliation_service.list_entries(
            sync_db, current_user, entry_status=entry_status
        )
    )


@router.post(
    "/entries",
    response_model=BankStatementEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_bank_statement_entry(
    payload: BankStatementEntryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    entry = bank_reconciliation_service.create_entry(db, current_user, payload)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="bank_statement_entry.recorded",
        entity_type="bank_statement_entry",
        entity_id=entry.id,
        request=request,
        details={"amount": str(entry.amount), "currency": entry.currency},
    )
    return entry


@router.post("/entries/{entry_id}/match", response_model=BankStatementEntryResponse)
def match_bank_statement_entry(
    entry_id: int,
    payload: BankReconciliationMatch,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    entry = bank_reconciliation_service.match_entry(db, current_user, entry_id, payload)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="bank_statement_entry.matched",
        entity_type="bank_statement_entry",
        entity_id=entry.id,
        request=request,
        details={"customer_payment_id": payload.customer_payment_id},
    )
    return entry


@router.post("/entries/{entry_id}/unmatch", response_model=BankStatementEntryResponse)
def unmatch_bank_statement_entry(
    entry_id: int,
    payload: BankReconciliationReverse,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveFinanceManager,
):
    entry = bank_reconciliation_service.reverse_match(db, current_user, entry_id, payload)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="bank_statement_entry.unmatched",
        entity_type="bank_statement_entry",
        entity_id=entry.id,
        request=request,
        details={"reason": payload.reason},
    )
    return entry
