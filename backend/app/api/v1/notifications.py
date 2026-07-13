from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AsyncActiveUser, get_async_db
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.services import notification_service


router = APIRouter()


@router.get("/", response_model=list[NotificationResponse])
async def read_notifications(
    unread_only: bool = True,
    limit: int = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await notification_service.list_notifications_async(
        db, current_user, unread_only=unread_only, limit=min(max(limit, 1), 200)
    )


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    notification = await notification_service.mark_read_async(
        db, current_user, notification_id
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return notification


@router.patch("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    await notification_service.mark_all_read_async(db, current_user)
