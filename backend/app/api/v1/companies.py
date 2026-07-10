from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, ActiveUser, ActiveManagerOrAdmin, ActiveAdmin
from app.services import company_service
from app.schemas.company import (
    CompanyCreate,
    CompanyProvisionCreate,
    CompanyUpdate,
    CompanyResponse,
    CompanyExpenseResponse,
)
from app.models.user import User
from app.services import audit_service

router = APIRouter()


@router.get("/", response_model=list[CompanyResponse])
def read_companies(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return company_service.get_companies(db, current_user, skip, limit)


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
def read_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return company_service.get_company(db, company_id, current_user)


@router.get(
    "/{company_id}/expenses",
    response_model=list[CompanyExpenseResponse],
)
def read_company_expenses(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    return company_service.get_company_expenses(db, company_id, current_user)


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
