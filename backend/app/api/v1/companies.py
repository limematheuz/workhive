from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.pagination import PaginationLimit, PaginationOffset
from app.api.deps import (
    ActiveAdmin,
    ActiveUser,
    AsyncActiveManagerOrAdmin,
    AsyncActiveUser,
    get_async_db,
    get_db,
)
from app.services import company_service
from app.services import company_onboarding_service
from app.schemas.company import (
    CompanyCreate,
    CompanyOnboardingComplete,
    CompanyOnboardingResponse,
    CompanyProvisionCreate,
    CompanyUpdate,
    CompanyResponse,
    CompanyExpenseResponse,
    CompanyMemberResponse,
)
from app.models.user import User
from app.services import audit_service

router = APIRouter()


@router.get("/", response_model=list[CompanyResponse])
async def read_companies(
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: company_service.get_companies(
            sync_db, current_user, skip, limit
        )
    )


@router.post(
    "/provision",
    status_code=status.HTTP_201_CREATED,
    response_model=CompanyResponse,
)
def provision_company(
    provision_data: CompanyProvisionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    company = company_service.provision_company(
        db, provision_data, current_user
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=company.id,
        action="company.provisioned",
        entity_type="company",
        entity_id=company.id,
        request=request,
        details={"subscription_plan": company.subscription_plan},
    )
    return company


@router.get("/{company_id}", response_model=CompanyResponse)
async def read_company(
    company_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: company_service.get_company(sync_db, company_id, current_user)
    )


@router.get(
    "/{company_id}/members",
    response_model=list[CompanyMemberResponse],
)
async def read_company_members(
    company_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: company_service.get_company_members(
            sync_db, company_id, current_user
        )
    )


@router.get(
    "/{company_id}/expenses",
    response_model=list[CompanyExpenseResponse],
)
async def read_company_expenses(
    company_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveManagerOrAdmin,
):
    return await db.run_sync(
        lambda sync_db: company_service.get_company_expenses(
            sync_db, company_id, current_user
        )
    )


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=CompanyResponse)
def create_company(
    company_data: CompanyCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    company = company_service.create_company(db, company_data, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=company.id,
        action="company.created",
        entity_type="company",
        entity_id=company.id,
        request=request,
    )
    return company


@router.post(
    "/{company_id}/onboarding/complete",
    response_model=CompanyOnboardingResponse,
)
def complete_company_onboarding(
    company_id: int,
    onboarding_data: CompanyOnboardingComplete,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    result = company_onboarding_service.complete_company_onboarding(
        db,
        company_id,
        onboarding_data,
        current_user,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=company_id,
        action="company.onboarding_completed",
        entity_type="company",
        entity_id=company_id,
        request=request,
        details={
            "operating_model": result.operating_model,
            "location_created": result.created,
        },
    )
    return result


@router.patch("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    company_data: CompanyUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    company = company_service.update_company(
        db, company_id, company_data, current_user
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=company.id,
        action="company.updated",
        entity_type="company",
        entity_id=company.id,
        request=request,
        details={
            "changed_fields": sorted(company_data.model_fields_set),
        },
    )
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(
    company_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    company_service.delete_company_permanently(db, company_id, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=None,
        action="company.deleted",
        entity_type="company",
        entity_id=company_id,
        request=request,
    )
    return None
