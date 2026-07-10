from sqlalchemy.orm import Session
from fastapi import Depends, APIRouter, status
from app.api.deps import get_db, ActiveUser, ActiveAdmin
from app.services import template_task_service
from app.schemas.template_task import (
    TemplateTaskCreate,
    TemplateTaskUpdate,
    TemplateTaskResponse,
)
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=list[TemplateTaskResponse])
def read_template_tasks(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return template_task_service.get_template_tasks(
        db, current_user.company_id, skip, limit
    )


@router.get("/{template_task_id}", response_model=TemplateTaskResponse)
def read_template_task(
    template_task_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return template_task_service.get_template_task(
        db, template_task_id, current_user.company_id
    )


@router.post(
    "/", response_model=TemplateTaskResponse, status_code=status.HTTP_201_CREATED
)
def create_template_task(
    template_task_data: TemplateTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return template_task_service.create_template_task(
        db, template_task_data, current_user.company_id
    )


@router.patch("/{template_task_id}", response_model=TemplateTaskResponse)
def update_template_task(
    template_task_update: TemplateTaskUpdate,
    template_task_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return template_task_service.update_template_task(
        db, template_task_id, template_task_update, current_user.company_id
    )


@router.delete("/{template_task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template_task(
    template_task_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    template_task_service.delete_template_task(
        db, template_task_id, current_user.company_id
    )
    return None
