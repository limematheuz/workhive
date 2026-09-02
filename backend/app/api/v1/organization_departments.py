from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveApplicationUser, get_db
from app.models.user import User
from app.schemas.organization import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
)
from app.services import audit_service, organization_service


router = APIRouter()


@router.get("/departments", response_model=list[DepartmentResponse])
def read_departments(
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    return organization_service.list_departments(db, current_user)


@router.post(
    "/departments",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_department(
    payload: DepartmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    department = organization_service.create_department(db, payload, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.department_created",
        entity_type="department",
        entity_id=department.id,
        request=request,
    )
    return department


@router.patch("/departments/{department_id}", response_model=DepartmentResponse)
def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    department = organization_service.update_department(
        db,
        department_id,
        payload,
        current_user,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.department_updated",
        entity_type="department",
        entity_id=department.id,
        request=request,
    )
    return department


@router.delete("/departments/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    department_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    organization_service.delete_department(db, department_id, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.department_deleted",
        entity_type="department",
        entity_id=department_id,
        request=request,
    )
