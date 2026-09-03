from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AsyncActiveUser, get_async_db
from app.api.pagination import PaginationLimit, PaginationOffset
from app.models.user import User
from app.schemas.task_item import TaskItemResponse
from app.services import (
    organization_authorization_service,
    task_assignment_service,
    task_item_service,
)
from app.services.user_scope import is_platform_superadmin


router = APIRouter()


@router.get("/", response_model=list[TaskItemResponse])
async def read_task_items(
    location_id: int | None = None,
    user_id: int | None = None,
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    task_status: str | None = None,
    current_user: User = AsyncActiveUser,
):
    if is_platform_superadmin(current_user):
        return []
    location_ids, requested_location_ids, uses_legacy_roles = await db.run_sync(
        lambda sync_db: organization_authorization_service.resolve_location_capabilities(
            sync_db,
            current_user,
            read_capability="work.read",
            manage_capability="work.manage",
        )
    )
    include_requested = requested_location_ids is None or bool(requested_location_ids)
    effective_user_id = (
        current_user.id
        if uses_legacy_roles and current_user.role.name == "viewer"
        else user_id
    )
    tasks = await task_item_service.get_task_items_async(
        db,
        current_user.company_id,
        effective_user_id,
        location_id,
        task_status,
        skip,
        limit,
        include_requested=include_requested,
        location_ids=location_ids,
        requested_location_ids=requested_location_ids,
        feature_checked=True,
    )
    if uses_legacy_roles and current_user.role.name == "viewer":
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
    uses_legacy_roles = await db.run_sync(
        lambda sync_db: (
            organization_authorization_service.require_capability(
                sync_db,
                current_user,
                "work.read",
                scope_type="location",
                scope_id=task.location_id,
            ),
            organization_authorization_service.uses_legacy_role_authorization(
                sync_db,
                current_user,
                "work.read",
            ),
        )[1]
    )
    if (
        uses_legacy_roles
        and current_user.role.name == "viewer"
        and (
            not task_assignment_service.can_viewer_access_task(task, current_user.id)
            or task.status not in task_assignment_service.OPERATIONAL_VIEWER_STATUSES
        )
    ):
        raise HTTPException(status_code=404, detail="Task Item not found")
    return task_item_service.build_loaded_task_response(task, current_user)
