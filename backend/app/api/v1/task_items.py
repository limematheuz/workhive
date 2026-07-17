from app.api.deps import (
    AsyncActiveManagerOrAdmin,
    AsyncActiveUser,
    get_async_db,
)
from fastapi import Depends, status, APIRouter, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.task_item import (
    TaskAcceptRequest,
    TaskWorkStartRequest,
    TaskItemCreate,
    TaskItemUpdate,
    TaskItemResponse,
    TaskChecklistItemUpdate,
)
from app.services import task_item_service
from app.services import task_assignment_service
from app.services.calendar_background_service import sync_company_calendar
from app.services.user_scope import can_manage_company, is_platform_superadmin


router = APIRouter()


@router.get("/", response_model=list[TaskItemResponse])
async def read_task_items(
    location_id: int | None = None,
    user_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_async_db),
    task_status: str | None = None,
    current_user: User = AsyncActiveUser,
):
    if is_platform_superadmin(current_user):
        return []
    effective_user_id = (
        current_user.id if current_user.role.name == "viewer" else user_id
    )
    include_requested = can_manage_company(current_user)
    tasks = await task_item_service.get_task_items_async(
        db,
        current_user.company_id,
        effective_user_id,
        location_id,
        task_status,
        skip,
        limit,
        include_requested=include_requested,
    )
    if current_user.role.name == "viewer":
        tasks = [
            task
            for task in tasks
            if task.status in task_assignment_service.OPERATIONAL_VIEWER_STATUSES
            and task_assignment_service.can_viewer_access_task(task, current_user.id)
        ]
    return [
        task_item_service.build_loaded_task_response(task, current_user)
        for task in tasks
    ]


@router.get("/{task_item_id}", response_model=TaskItemResponse)
async def read_task_item(
    task_item_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    task = await task_item_service.get_task_item_async(db, current_user, task_item_id)
    if (
        current_user.role.name == "viewer"
        and (
            not task_assignment_service.can_viewer_access_task(task, current_user.id)
            or task.status not in task_assignment_service.OPERATIONAL_VIEWER_STATUSES
        )
    ):
        raise HTTPException(status_code=404, detail="Task Item not found")
    return task_item_service.build_loaded_task_response(task, current_user)


@router.post("/", response_model=TaskItemResponse, status_code=status.HTTP_201_CREATED)
async def create_task_item(
    task_item_data: TaskItemCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveManagerOrAdmin,
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
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
    background_tasks: BackgroundTasks = None,
):
    def operation(sync_db: Session):
        task = task_item_service.finish_task_work(
            sync_db,
            current_user,
            task_item_id,
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
    current_user: User = AsyncActiveManagerOrAdmin,
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
