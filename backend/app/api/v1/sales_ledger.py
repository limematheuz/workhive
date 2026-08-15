from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import ActiveAdmin, AsyncActiveAdmin, get_async_db, get_db
from app.api.pagination import PaginationLimit, PaginationOffset
from app.models.user import User
from app.schemas.sales_ledger import (
    SalesLedgerCsvImportResponse,
    SalesLedgerCsvPreview,
    SalesLedgerEntryResponse,
    SalesLedgerManualRecordCreate,
    SalesLedgerManualRecordUpdate,
)
from app.services import audit_service, sales_ledger_service
from app.services.user_scope import is_platform_superadmin


router = APIRouter()


def _require_company_admin(current_user: User) -> None:
    if is_platform_superadmin(current_user) or current_user.company_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Company admin required")


async def _read_csv_file(file: UploadFile) -> bytes:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Upload a CSV file")
    return await file.read()


@router.get("/", response_model=list[SalesLedgerEntryResponse])
async def read_sales_ledger(
    year: int | None = None,
    search: str | None = None,
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveAdmin,
):
    _require_company_admin(current_user)
    return await db.run_sync(
        lambda sync_db: sales_ledger_service.list_entries(
            sync_db,
            current_user.company_id,
            year=year,
            search=search,
            skip=skip,
            limit=limit,
        )
    )


@router.post(
    "/manual-records",
    response_model=SalesLedgerEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_manual_record(
    payload: SalesLedgerManualRecordCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    _require_company_admin(current_user)
    entry = sales_ledger_service.create_manual_record(
        db,
        current_user.company_id,
        current_user.id,
        payload,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="sales_ledger.manual_record_created",
        entity_type="sales_ledger_record",
        entity_id=entry.source_id,
        request=request,
    )
    return entry


@router.patch("/manual-records/{record_id}", response_model=SalesLedgerEntryResponse)
def update_manual_record(
    record_id: int,
    payload: SalesLedgerManualRecordUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    _require_company_admin(current_user)
    entry = sales_ledger_service.update_manual_record(
        db,
        current_user.company_id,
        record_id,
        payload,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="sales_ledger.manual_record_updated",
        entity_type="sales_ledger_record",
        entity_id=record_id,
        request=request,
        details={"changed_fields": sorted(payload.model_fields_set)},
    )
    return entry


@router.delete("/manual-records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_manual_record(
    record_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    _require_company_admin(current_user)
    sales_ledger_service.delete_manual_record(db, current_user.company_id, record_id)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="sales_ledger.manual_record_deleted",
        entity_type="sales_ledger_record",
        entity_id=record_id,
        request=request,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/manual-records/import/preview", response_model=SalesLedgerCsvPreview)
async def preview_manual_records_import(
    file: UploadFile = File(...),
    current_user: User = AsyncActiveAdmin,
):
    _require_company_admin(current_user)
    return sales_ledger_service.preview_csv(await _read_csv_file(file))


@router.post(
    "/manual-records/import",
    response_model=SalesLedgerCsvImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def import_manual_records(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveAdmin,
):
    _require_company_admin(current_user)
    csv_content = await _read_csv_file(file)

    def import_records(sync_db: Session) -> int:
        created_count = sales_ledger_service.import_csv(
            sync_db,
            current_user.company_id,
            current_user.id,
            csv_content,
        )
        audit_service.record_event(
            sync_db,
            actor=current_user,
            company_id=current_user.company_id,
            action="sales_ledger.manual_records_imported",
            entity_type="sales_ledger_record",
            entity_id=None,
            request=request,
            details={"created_count": created_count},
        )
        return created_count

    created_count = await db.run_sync(import_records)
    return SalesLedgerCsvImportResponse(created_count=created_count)
