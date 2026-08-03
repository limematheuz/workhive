from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ActiveAdmin, AsyncActiveAdmin, get_async_db, get_db
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.fiscal_settings import (
    CompanyFiscalSettingsResponse,
    CompanyFiscalSettingsUpdate,
)
from app.services import company_fiscal_settings_service


router = APIRouter()


@router.get("/", response_model=CompanyFiscalSettingsResponse)
async def read_company_fiscal_settings(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveAdmin,
):
    return await db.run_sync(
        lambda sync_db: _read_company_fiscal_settings(
            sync_db, current_user.company_id
        )
    )


def _read_company_fiscal_settings(db: Session, company_id: int):
    company_fiscal_settings_service.get_or_create_settings(
        db,
        company_id,
    )
    return company_fiscal_settings_service.get_readiness(
        db,
        company_id,
    )


@router.patch("/", response_model=CompanyFiscalSettingsResponse)
def update_company_fiscal_settings(
    data: CompanyFiscalSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    company_fiscal_settings_service.update_settings(
        db,
        current_user.company_id,
        data,
    )
    return company_fiscal_settings_service.get_readiness(
        db,
        current_user.company_id,
    )


@router.post(
    "/certificate",
    response_model=CompanyFiscalSettingsResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_company_fiscal_certificate(
    request: Request,
    file: UploadFile = File(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    enforce_rate_limit(
        request,
        "fiscal-certificate-upload",
        settings.MEDIA_UPLOAD_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(current_user.id),
    )
    contents = file.file.read(
        company_fiscal_settings_service.MAX_CERTIFICATE_BYTES + 1
    )
    company_fiscal_settings_service.store_certificate(
        db,
        current_user.company_id,
        contents=contents,
        password=password,
    )
    return company_fiscal_settings_service.get_readiness(
        db,
        current_user.company_id,
    )


@router.post("/validate", response_model=CompanyFiscalSettingsResponse)
def validate_company_fiscal_settings(
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return company_fiscal_settings_service.get_readiness(
        db,
        current_user.company_id,
    )
