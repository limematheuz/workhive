"""Business rules that reconcile bank evidence to customer receipts."""

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.bank_reconciliation import BankReconciliation, BankStatementEntry
from app.models.user import User
from app.repositories import bank_reconciliation as bank_reconciliation_repo
from app.repositories import customer_payment as customer_payment_repo
from app.schemas.bank_reconciliation import (
    BankReconciliationMatch,
    BankReconciliationReverse,
    BankStatementEntryCreate,
)
from app.services.entitlement_service import require_company_feature


MONEY = Decimal("0.01")


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY, rounding=ROUND_HALF_UP)


def _company_id(current_user: User) -> int:
    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company context is required",
        )
    return current_user.company_id


def _require_feature(db: Session, company_id: int) -> None:
    require_company_feature(db, company_id=company_id, code="features.invoices")


def _entry_or_404(
    db: Session, *, company_id: int, entry_id: int, for_update: bool = False
) -> BankStatementEntry:
    entry = bank_reconciliation_repo.get_entry(
        db,
        company_id=company_id,
        entry_id=entry_id,
        for_update=for_update,
    )
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Apunte bancario no encontrado",
        )
    return entry


def _response(entry: BankStatementEntry) -> BankStatementEntry:
    entry.current_reconciliation = next(
        (
            reconciliation
            for reconciliation in entry.reconciliations
            if reconciliation.status == "matched"
        ),
        None,
    )
    return entry


def list_entries(
    db: Session,
    current_user: User,
    *,
    entry_status: str | None = None,
) -> list[BankStatementEntry]:
    company_id = _company_id(current_user)
    _require_feature(db, company_id)
    if entry_status not in {None, "unmatched", "matched"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Estado de conciliación no válido",
        )
    return [
        _response(entry)
        for entry in bank_reconciliation_repo.list_entries(
            db, company_id=company_id, entry_status=entry_status
        )
    ]


def create_entry(
    db: Session,
    current_user: User,
    payload: BankStatementEntryCreate,
) -> BankStatementEntry:
    company_id = _company_id(current_user)
    _require_feature(db, company_id)
    try:
        entry = bank_reconciliation_repo.create_entry(
            db,
            company_id=company_id,
            booked_at=payload.booked_at,
            amount=payload.amount,
            currency=payload.currency,
            account_label=payload.account_label,
            external_id=payload.external_id,
            reference=payload.reference,
            counterparty=payload.counterparty,
            notes=payload.notes,
            status="unmatched",
            created_by_user_id=current_user.id,
        )
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un apunte con ese identificador bancario",
        ) from error
    return _response(_entry_or_404(db, company_id=company_id, entry_id=entry.id))


def match_entry(
    db: Session,
    current_user: User,
    entry_id: int,
    payload: BankReconciliationMatch,
) -> BankStatementEntry:
    company_id = _company_id(current_user)
    _require_feature(db, company_id)
    entry = _entry_or_404(db, company_id=company_id, entry_id=entry_id, for_update=True)
    if entry.status != "unmatched":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El apunte ya está conciliado",
        )
    payment = customer_payment_repo.get_payment(
        db,
        company_id=company_id,
        payment_id=payload.customer_payment_id,
        for_update=True,
    )
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cobro no encontrado")
    if payment.status != "received":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se pueden conciliar cobros recibidos",
        )
    if bank_reconciliation_repo.payment_has_active_reconciliation(
        db, customer_payment_id=payment.id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El cobro ya está conciliado con otro apunte bancario",
        )
    if _money(Decimal(str(entry.amount))) != _money(Decimal(str(payment.amount))):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="El importe del apunte debe coincidir exactamente con el cobro",
        )
    if bank_reconciliation_repo.get_active_reconciliation(
        db, entry_id=entry.id, for_update=True
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El apunte ya tiene una conciliación activa",
        )
    try:
        bank_reconciliation_repo.create_reconciliation(
            db,
            bank_statement_entry_id=entry.id,
            customer_payment_id=payment.id,
            status="matched",
            matched_by_user_id=current_user.id,
        )
        entry.status = "matched"
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return _response(_entry_or_404(db, company_id=company_id, entry_id=entry.id))


def reverse_match(
    db: Session,
    current_user: User,
    entry_id: int,
    payload: BankReconciliationReverse,
) -> BankStatementEntry:
    company_id = _company_id(current_user)
    _require_feature(db, company_id)
    entry = _entry_or_404(db, company_id=company_id, entry_id=entry_id, for_update=True)
    reconciliation = bank_reconciliation_repo.get_active_reconciliation(
        db, entry_id=entry.id, for_update=True
    )
    if entry.status != "matched" or reconciliation is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El apunte no tiene una conciliación activa",
        )
    try:
        reconciliation.status = "reversed"
        reconciliation.reversed_by_user_id = current_user.id
        reconciliation.reversed_at = datetime.now(timezone.utc)
        reconciliation.reversal_reason = payload.reason
        entry.status = "unmatched"
        db.add_all([reconciliation, entry])
        db.commit()
    except Exception:
        db.rollback()
        raise
    return _response(_entry_or_404(db, company_id=company_id, entry_id=entry.id))


def payment_is_reconciled(db: Session, *, customer_payment_id: int) -> bool:
    """Expose the correction guard to the customer-payment service."""
    return bank_reconciliation_repo.payment_has_active_reconciliation(
        db, customer_payment_id=customer_payment_id
    )
