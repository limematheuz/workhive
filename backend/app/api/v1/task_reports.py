from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AsyncActiveUser, get_async_db
from app.models.user import User
from app.schemas.task_report import (
    TaskReportBulkDelete,
    TaskReportCreate,
    TaskReportResponse,
    TaskReportUpdate,
)
from app.services import task_report_service


router = APIRouter()


@router.post(
    "/",
    response_model=TaskReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_report(
    payload: TaskReportCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await task_report_service.create_report(db, current_user, payload)


@router.get("/", response_model=list[TaskReportResponse])
async def read_task_reports(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await task_report_service.list_reports(
        db,
        current_user,
        skip=max(skip, 0),
        limit=min(max(limit, 1), 200),
    )


@router.patch("/notifications/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_task_report_notifications_read(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    await task_report_service.mark_report_notifications_read(db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_task_reports(
    payload: TaskReportBulkDelete,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    await task_report_service.bulk_delete_reports(db, current_user, payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{report_id}", response_model=TaskReportResponse)
async def read_task_report(
    report_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await task_report_service.get_report_response(db, current_user, report_id)


@router.patch("/{report_id}", response_model=TaskReportResponse)
async def update_task_report(
    report_id: int,
    payload: TaskReportUpdate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await task_report_service.update_report(db, current_user, report_id, payload)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_report(
    report_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    await task_report_service.delete_report(db, current_user, report_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{report_id}/media")
async def read_task_report_media(
    report_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    stored = await task_report_service.get_report_media(db, current_user, report_id)
    return Response(
        content=stored.contents,
        media_type=stored.content_type,
        headers={"Cache-Control": "private, no-store"},
    )
