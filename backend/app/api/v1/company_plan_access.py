"""Platform routes for commercial plan access and company-specific exceptions."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.models.user import User
from app.schemas.company_entitlement_management import (
    CompanyEntitlementOverrideCreate,
    CompanyEntitlementCustomizationUpdate,
    CompanyEntitlementOverrideResponse,
    CurrentCompanyEntitlementsResponse,
    CompanyPlanAccessResponse,
    CompanyPlanAccessUpdate,
    PlanCatalogUpdate,
    PlanCatalogResponse,
)
from app.services import (
    company_entitlement_management_service,
    plan_catalog_management_service,
)


router = APIRouter()


@router.get("/plans/catalog", response_model=list[PlanCatalogResponse])
def read_plan_catalog(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return plan_catalog_management_service.list_plan_catalog(db, current_user)


@router.put("/plans/{plan_code}", response_model=PlanCatalogResponse)
def update_standard_plan(
    plan_code: str,
    update: PlanCatalogUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return plan_catalog_management_service.update_standard_plan(
        db,
        plan_code=plan_code,
        update=update,
        current_user=current_user,
    )


@router.get("/current/entitlements", response_model=CurrentCompanyEntitlementsResponse)
def read_current_company_entitlements(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return company_entitlement_management_service.get_current_company_entitlements(
        db, current_user
    )


@router.get("/{company_id}/plan-access", response_model=CompanyPlanAccessResponse)
def read_company_plan_access(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return company_entitlement_management_service.get_company_plan_access(
        db, company_id=company_id, current_user=current_user
    )


@router.put("/{company_id}/plan-access", response_model=CompanyPlanAccessResponse)
def update_company_plan_access(
    company_id: int,
    update: CompanyPlanAccessUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return company_entitlement_management_service.update_company_plan_access(
        db,
        company_id=company_id,
        update=update,
        current_user=current_user,
    )


@router.put(
    "/{company_id}/plan-access/customization",
    response_model=CompanyPlanAccessResponse,
)
def replace_company_plan_customization(
    company_id: int,
    update: CompanyEntitlementCustomizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return company_entitlement_management_service.replace_company_entitlement_customization(
        db,
        company_id=company_id,
        update=update,
        current_user=current_user,
    )


@router.post(
    "/{company_id}/plan-access/overrides",
    status_code=status.HTTP_201_CREATED,
    response_model=CompanyEntitlementOverrideResponse,
)
def create_company_plan_override(
    company_id: int,
    override_data: CompanyEntitlementOverrideCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return company_entitlement_management_service.create_company_entitlement_override(
        db,
        company_id=company_id,
        override_data=override_data,
        current_user=current_user,
    )
