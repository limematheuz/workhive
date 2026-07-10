from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveAdmin, get_db
from app.models.user import User
from app.schemas.fiscal_settings import (
    CompanyFiscalSettingsResponse,
    CompanyFiscalSettingsUpdate,
)
from app.services import company_fiscal_settings_service


router = APIRouter()


@router.get("/", response_model=CompanyFiscalSettingsResponse)
def read_company_fiscal_settings(
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    company_fiscal_settings_service.get_or_create_settings(
        db,
        current_user.company_id,
    )
    return company_fiscal_settings_service.get_readiness(
        db,
        current_user.company_id,
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
async def upload_company_fiscal_certificate(
    file: UploadFile = File(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    contents = await file.read(
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
