from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import AsyncActiveFinancialReader, get_async_db
from app.models.user import User
from app.services import accountant_export_service, audit_service
from app.services.user_scope import is_platform_superadmin


router = APIRouter()


def _require_company_admin(current_user: User) -> None:
    if is_platform_superadmin(current_user) or current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Company admin required"
        )


@router.get("/accountant")
async def download_accountant_export(
    request: Request,
    year: int = Query(ge=2000, le=2100),
    period: Literal["year", "month", "quarter", "semester"] = "year",
    period_number: int | None = Query(default=None),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveFinancialReader,
):
    _require_company_admin(current_user)
    try:
        export_period = accountant_export_service.resolve_export_period(
            year=year,
            period=period,
            period_number=period_number,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        ) from error

    def create_export(sync_db: Session) -> accountant_export_service.AccountantExport:
        export = accountant_export_service.build_accountant_export(
            sync_db, current_user.company_id, export_period
        )
        audit_service.record_event(
            sync_db,
            actor=current_user,
            company_id=current_user.company_id,
            action="accounting_export.accountant_downloaded",
            entity_type="accounting_export",
            entity_id=year,
            request=request,
            details={
                "year": year,
                "period": export_period.kind,
                "period_number": export_period.number,
                "invoice_count": export.invoice_count,
                "expense_count": export.expense_count,
            },
        )
        return export

    export = await db.run_sync(create_export)
    return Response(
        content=export.content,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{export.filename}"',
            "Cache-Control": "no-store",
        },
    )
