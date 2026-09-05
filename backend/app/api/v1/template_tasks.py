from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, APIRouter, status
from app.api.deps import ActiveAdmin, AsyncActiveUser, get_async_db, get_db
from app.api.pagination import PaginationLimit, PaginationOffset
from app.services import template_task_service
from app.schemas.template_task import (
    TemplateTaskCreate,
    TemplateTaskUpdate,
    TemplateTaskResponse,
)
from app.models.user import User
from app.services.user_scope import require_company_context

router = APIRouter()


@router.get("/", response_model=list[TemplateTaskResponse])
async def read_template_tasks(
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: template_task_service.get_template_tasks(
            sync_db, require_company_context(current_user), skip, limit
        )
    )


@router.get("/{template_task_id}", response_model=TemplateTaskResponse)
async def read_template_task(
    template_task_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: template_task_service.get_template_task(
            sync_db, template_task_id, require_company_context(current_user)
        )
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
        db, template_task_data, require_company_context(current_user)
    )


@router.patch("/{template_task_id}", response_model=TemplateTaskResponse)
def update_template_task(
    template_task_update: TemplateTaskUpdate,
    template_task_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    return template_task_service.update_template_task(
        db,
        template_task_id,
        template_task_update,
        require_company_context(current_user),
    )


@router.delete("/{template_task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template_task(
    template_task_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveAdmin,
):
    template_task_service.delete_template_task(
        db, template_task_id, require_company_context(current_user)
    )
    return None
