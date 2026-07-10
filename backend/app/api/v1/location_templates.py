from fastapi import Depends, APIRouter, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, ActiveUser, ActiveAdmin, ActiveManagerOrAdmin
from app.services import location_template_service
from app.services import location_service
from app.schemas.location_template import (
    LocationTemplateCreate,
    LocationTemplateResponse,
    LocationTemplateUpdate,
)
from app.models.user import User
from app.services import location_access_service
from app.services.user_scope import scoped_company_id

router = APIRouter()


def _get_location_owner_company_id(location) -> int | None:
    return (
        location.owner_company_id
        or (location.client.company_id if location.client else None)
        or location.managing_company_id
    )


@router.get("/{location_id}/templates", response_model=list[LocationTemplateResponse])
def read_locations_template(
    location_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    company_id = scoped_company_id(current_user)
    location = location_service.get_location(db, location_id, company_id)
    owner_company_id = _get_location_owner_company_id(location)
    return location_template_service.get_templates_by_location(
        db, location_id, owner_company_id, skip, limit
    )


@router.get(
    "/{location_id}/templates/{template_task_id}",
    response_model=LocationTemplateResponse,
)
def read_location_template(
    location_id: int,
    template_task_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    company_id = scoped_company_id(current_user)
    location = location_service.get_location(db, location_id, company_id)
    owner_company_id = _get_location_owner_company_id(location)
    return location_template_service.get_location_template(
        db, location_id, template_task_id, owner_company_id
    )


@router.post(
    "/{location_id}/templates",
    response_model=LocationTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_location_template(
    location_id: int,
    location_template_data: LocationTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    return location_template_service.assign_template_to_location(
        db, location_id, location_template_data, current_user.company_id
    )


@router.patch(
    "/{location_id}/templates/{template_task_id}",
    response_model=LocationTemplateResponse,
)
def update_location_template(
    location_id: int,
    template_task_id: int,
    location_template_data: LocationTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    return location_template_service.update_location_template(
        db,
        location_id,
        template_task_id,
        location_template_data,
        current_user.company_id,
    )


@router.delete(
    "/{location_id}/templates/{template_task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_template(
    template_task_id: int,
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)

    location_template_service.remove_template_from_location(
        db, location_id, template_task_id, current_user.company_id
    )
