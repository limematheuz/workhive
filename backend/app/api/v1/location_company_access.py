from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveAdmin, get_db
from app.models.user import User
from app.schemas.location_company_access import (
    LocationCompanyAccessCreate,
    LocationCompanyAccessResponse,
    LocationCompanyAccessUpdate,
)
from app.services import location_access_service


router = APIRouter()


@router.get(
    "/{location_id}/company-access",
    response_model=list[LocationCompanyAccessResponse],
)
def read_location_company_access(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return location_access_service.list_location_access(db, current_user, location_id)


@router.post(
    "/{location_id}/company-access",
    response_model=LocationCompanyAccessResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_location_company_access(
    location_id: int,
    access_data: LocationCompanyAccessCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return location_access_service.create_location_access(
        db, current_user, location_id, access_data
    )


@router.patch(
    "/{location_id}/company-access/{company_id}",
    response_model=LocationCompanyAccessResponse,
)
def update_location_company_access(
    location_id: int,
    company_id: int,
    access_data: LocationCompanyAccessUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return location_access_service.update_location_access(
        db, current_user, location_id, company_id, access_data
    )


@router.delete(
    "/{location_id}/company-access/{company_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_location_company_access(
    location_id: int,
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    location_access_service.delete_location_access(
        db, current_user, location_id, company_id
    )
