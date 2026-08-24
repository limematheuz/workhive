from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.task_item import TaskItem
from app.models.user import User
from app.repositories import async_task_item as async_task_item_repo
from app.repositories import task_item as task_item_repo
from app.schemas.task_item import TaskItemResponse
from app.services import location_access_service


_SENSITIVE_BILLING_FIELDS = {
    "price": None,
    "quantity": None,
    "billing_pricing_mode_snapshot": None,
    "billing_price_snapshot": None,
    "billing_quantity_snapshot": None,
    "billing_unit_snapshot": None,
}


def get_task_items(
    db: Session,
    company_id: int,
    user_id: int | None = None,
    location_id: int | None = None,
    task_status: str | None = None,
    skip: int = 0,
    limit: int = 100,
    include_requested: bool = False,
) -> list[TaskItem]:
    return task_item_repo.get_task_items(
        db,
        company_id,
        user_id,
        location_id,
        task_status,
        skip,
        limit,
        include_requested,
    )


async def get_task_items_async(
    db: AsyncSession,
    company_id: int,
    user_id: int | None = None,
    location_id: int | None = None,
    task_status: str | None = None,
    skip: int = 0,
    limit: int = 100,
    include_requested: bool = False,
) -> list[TaskItem]:
    return await async_task_item_repo.get_task_items(
        db,
        company_id,
        user_id,
        location_id,
        task_status,
        skip,
        limit,
        include_requested,
    )


async def get_task_item_async(
    db: AsyncSession,
    current_user: User,
    task_item_id: int,
) -> TaskItem:
    existing = await async_task_item_repo.get_task_item(
        db,
        current_user.company_id,
        task_item_id,
    )
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task Item not found",
        )
    return existing


def get_task_item(db: Session, current_user: User, task_item_id: int) -> TaskItem:
    existing = task_item_repo.get_task_item(db, current_user.company_id, task_item_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task Item not found"
        )
    return existing


def _without_sensitive_billing(response: TaskItemResponse) -> TaskItemResponse:
    return response.model_copy(update=_SENSITIVE_BILLING_FIELDS)


def build_task_response(
    db: Session,
    task: TaskItem,
    current_user: User,
) -> TaskItemResponse:
    from app.services import reservation_service

    response = TaskItemResponse.model_validate(task)
    live_snapshot = reservation_service.get_live_external_task_snapshot(db, task)
    if live_snapshot:
        response = response.model_copy(update=live_snapshot)
    if not location_access_service.can_view_sensitive(
        db,
        current_user,
        task.location_id,
    ):
        return _without_sensitive_billing(response)
    return response


def build_loaded_task_response(
    task: TaskItem,
    current_user: User,
) -> TaskItemResponse:
    from app.services.reservation_tasks import get_live_external_task_snapshot_loaded

    response = TaskItemResponse.model_validate(task)
    live_snapshot = get_live_external_task_snapshot_loaded(task)
    if live_snapshot:
        response = response.model_copy(update=live_snapshot)
    if not location_access_service.can_view_sensitive_loaded(
        current_user,
        task.location,
    ):
        return _without_sensitive_billing(response)
    return response
