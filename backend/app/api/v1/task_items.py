from app.api.deps import (
    ActiveManagerOrAdmin,
    ActiveUser,
    AsyncActiveUser,
    get_async_db,
    get_db,
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
from app.services.calendar_background_service import sync_user_calendar
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
def create_task_item(
    task_item_data: TaskItemCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
    background_tasks: BackgroundTasks = None,
):
    task = task_item_service.create_task_item(db, current_user, task_item_data)
    if background_tasks:
        background_tasks.add_task(sync_user_calendar, current_user.company_id, current_user.id)
    return task_item_service.build_task_response(db, task, current_user)


@router.patch("/{task_item_id}", response_model=TaskItemResponse, status_code=status.HTTP_200_OK)
def update_task_item(
    task_item_data: TaskItemUpdate,
    task_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
    background_tasks: BackgroundTasks = None,
):
    task = task_item_service.update_task_item(db, current_user, task_item_id, task_item_data)
    if background_tasks:
        background_tasks.add_task(sync_user_calendar, current_user.company_id, current_user.id)
    return task_item_service.build_task_response(db, task, current_user)


@router.patch(
    "/{task_item_id}/checklist-items/{checklist_item_id}",
    response_model=TaskItemResponse,
)
def update_task_checklist_item(
    task_item_id: int,
    checklist_item_id: int,
    item_data: TaskChecklistItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
    background_tasks: BackgroundTasks = None,
):
    task = task_item_service.update_task_checklist_item(
        db,
        current_user,
        task_item_id,
        checklist_item_id,
        item_data,
    )
    if background_tasks:
        background_tasks.add_task(
            sync_user_calendar,
            current_user.company_id,
            current_user.id,
        )
    return task_item_service.build_task_response(db, task, current_user)


@router.post("/{task_item_id}/start-work", response_model=TaskItemResponse)
def start_task_work(
    task_item_id: int,
    start_data: TaskWorkStartRequest,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
    background_tasks: BackgroundTasks = None,
):
    task = task_item_service.start_task_work(
        db,
        current_user,
        task_item_id,
        start_data.notes,
        start_data.start_latitude,
        start_data.start_longitude,
        start_data.start_accuracy_meters,
    )
    if background_tasks:
        background_tasks.add_task(sync_user_calendar, current_user.company_id, current_user.id)
    return task_item_service.build_task_response(db, task, current_user)


@router.post("/{task_item_id}/finish-work", response_model=TaskItemResponse)
def finish_task_work(
    task_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
    background_tasks: BackgroundTasks = None,
):
    task = task_item_service.finish_task_work(
        db, current_user, task_item_id
    )
    if background_tasks:
        background_tasks.add_task(sync_user_calendar, current_user.company_id, current_user.id)
    return task_item_service.build_task_response(db, task, current_user)


@router.delete("/{task_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_item(
    task_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
    background_tasks: BackgroundTasks = None,
):
    task_item_service.delete_task_item(db, current_user, task_item_id)
    if background_tasks:
        background_tasks.add_task(sync_user_calendar, current_user.company_id, current_user.id)


@router.post("/{task_item_id}/accept", response_model=TaskItemResponse)
def accept_task_item(
    task_item_id: int,
    accept_data: TaskAcceptRequest = TaskAcceptRequest(),
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
    background_tasks: BackgroundTasks = None,
):
    updated_task = task_item_service.accept_task_item(
        db, current_user, task_item_id, accept_data
    )
    if background_tasks:
        background_tasks.add_task(sync_user_calendar, current_user.company_id, current_user.id)
    return task_item_service.build_task_response(db, updated_task, current_user)


@router.post("/{task_item_id}/reject", response_model=TaskItemResponse)
def reject_task_item(
    task_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
    background_tasks: BackgroundTasks = None,
):
    updated_task = task_item_service.reject_task_item(db, current_user, task_item_id)
    if background_tasks:
        background_tasks.add_task(sync_user_calendar, current_user.company_id, current_user.id)
    return task_item_service.build_task_response(db, updated_task, current_user)
