from app.api.deps import AsyncActiveUser, get_async_db
from fastapi import Depends, status, APIRouter, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.task_item import (
    TaskAcceptRequest,
    TaskWorkFinishRequest,
    TaskWorkStartRequest,
    TaskItemCreate,
    TaskItemUpdate,
    TaskItemResponse,
    TaskChecklistItemUpdate,
)
from app.services import task_duplication_service, task_item_service
from app.services.calendar_background_service import sync_company_calendar
from app.api.v1.task_item_read import (  # noqa: F401
    read_task_item as read_task_item,
    read_task_items as read_task_items,
)


router = APIRouter()


@router.post("/", response_model=TaskItemResponse, status_code=status.HTTP_201_CREATED)
async def create_task_item(
    task_item_data: TaskItemCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
    background_tasks: BackgroundTasks = None,
):
    def operation(sync_db: Session):
        task = task_item_service.create_task_item(
            sync_db,
            current_user,
            task_item_data,
        )
        return task_item_service.build_task_response(sync_db, task, current_user)

    response = await db.run_sync(operation)
    if background_tasks:
        background_tasks.add_task(sync_company_calendar, current_user.company_id)
    return response


@router.post("/{task_item_id}/duplicate", response_model=TaskItemResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_task_item(
    task_item_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
    background_tasks: BackgroundTasks = None,
):
    def operation(sync_db: Session):
        task = task_duplication_service.duplicate_task_item(sync_db, current_user, task_item_id)
        return task_item_service.build_task_response(sync_db, task, current_user)

    response = await db.run_sync(operation)
    if background_tasks:
        background_tasks.add_task(sync_company_calendar, current_user.company_id)
    return response


@router.patch("/{task_item_id}", response_model=TaskItemResponse, status_code=status.HTTP_200_OK)
async def update_task_item(
    task_item_data: TaskItemUpdate,
    task_item_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
    background_tasks: BackgroundTasks = None,
):
    def operation(sync_db: Session):
        task = task_item_service.update_task_item(
            sync_db,
            current_user,
            task_item_id,
            task_item_data,
        )
        return task_item_service.build_task_response(sync_db, task, current_user)

    response = await db.run_sync(operation)
    if background_tasks:
        background_tasks.add_task(sync_company_calendar, current_user.company_id)
    return response


@router.patch(
    "/{task_item_id}/checklist-items/{checklist_item_id}",
    response_model=TaskItemResponse,
)
async def update_task_checklist_item(
    task_item_id: int,
    checklist_item_id: int,
    item_data: TaskChecklistItemUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
    background_tasks: BackgroundTasks = None,
):
    def operation(sync_db: Session):
        task = task_item_service.update_task_checklist_item(
            sync_db,
            current_user,
            task_item_id,
            checklist_item_id,
            item_data,
        )
        return task_item_service.build_task_response(sync_db, task, current_user)

    response = await db.run_sync(operation)
    if background_tasks:
        background_tasks.add_task(
            sync_company_calendar,
            current_user.company_id,
        )
    return response


@router.post("/{task_item_id}/start-work", response_model=TaskItemResponse)
async def start_task_work(
    task_item_id: int,
    start_data: TaskWorkStartRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
    background_tasks: BackgroundTasks = None,
):
    def operation(sync_db: Session):
        task = task_item_service.start_task_work(
            sync_db,
            current_user,
            task_item_id,
            start_data.notes,
            start_data.start_latitude,
            start_data.start_longitude,
            start_data.start_accuracy_meters,
        )
        return task_item_service.build_task_response(sync_db, task, current_user)

    response = await db.run_sync(operation)
    if background_tasks:
        background_tasks.add_task(sync_company_calendar, current_user.company_id)
    return response


@router.post("/{task_item_id}/finish-work", response_model=TaskItemResponse)
async def finish_task_work(
    task_item_id: int,
    finish_data: TaskWorkFinishRequest | None = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
    background_tasks: BackgroundTasks = None,
):
    def operation(sync_db: Session):
        task = task_item_service.finish_task_work(
            sync_db,
            current_user,
            task_item_id,
            end_latitude=finish_data.end_latitude if finish_data else None,
            end_longitude=finish_data.end_longitude if finish_data else None,
            end_accuracy_meters=(
                finish_data.end_accuracy_meters if finish_data else None
            ),
        )
        return task_item_service.build_task_response(sync_db, task, current_user)

    response = await db.run_sync(operation)
    if background_tasks:
        background_tasks.add_task(sync_company_calendar, current_user.company_id)
    return response


@router.delete("/{task_item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_item(
    task_item_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
    background_tasks: BackgroundTasks = None,
):
    await db.run_sync(
        lambda sync_db: task_item_service.delete_task_item(
            sync_db,
            current_user,
            task_item_id,
        )
    )
    if background_tasks:
        background_tasks.add_task(sync_company_calendar, current_user.company_id)


@router.post("/{task_item_id}/accept", response_model=TaskItemResponse)
async def accept_task_item(
    task_item_id: int,
    accept_data: TaskAcceptRequest = TaskAcceptRequest(),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
    background_tasks: BackgroundTasks = None,
):
    def operation(sync_db: Session):
        task = task_item_service.accept_task_item(
            sync_db,
            current_user,
            task_item_id,
            accept_data,
        )
        return task_item_service.build_task_response(sync_db, task, current_user)

    response = await db.run_sync(operation)
    if background_tasks:
        background_tasks.add_task(sync_company_calendar, current_user.company_id)
    return response


@router.post("/{task_item_id}/reject", response_model=TaskItemResponse)
async def reject_task_item(
    task_item_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
    background_tasks: BackgroundTasks = None,
):
    def operation(sync_db: Session):
        task = task_item_service.reject_task_item(
            sync_db,
            current_user,
            task_item_id,
        )
        return task_item_service.build_task_response(sync_db, task, current_user)

    response = await db.run_sync(operation)
    if background_tasks:
        background_tasks.add_task(sync_company_calendar, current_user.company_id)
    return response
