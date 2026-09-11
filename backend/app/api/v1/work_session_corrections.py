from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AsyncActiveUser, get_async_db
from app.models.user import User
from app.schemas.work_session_correction import (
    WorkSessionCorrectionCreate,
    WorkSessionCorrectionResponse,
    WorkSessionCorrectionReview,
)
from app.services import work_session_correction_service


router = APIRouter()


@router.get("/", response_model=list[WorkSessionCorrectionResponse])
async def read_work_session_corrections(
    review_queue: bool = False,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: work_session_correction_service.list_corrections(
            sync_db,
            current_user,
            review_queue=review_queue,
        )
    )


@router.post(
    "/sessions/{work_session_id}",
    response_model=WorkSessionCorrectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_work_session_correction(
    work_session_id: int,
    correction_data: WorkSessionCorrectionCreate,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: work_session_correction_service.request_correction(
            sync_db,
            current_user,
            work_session_id,
            correction_data,
        )
    )


@router.post("/{correction_id}/review", response_model=WorkSessionCorrectionResponse)
async def review_work_session_correction(
    correction_id: int,
    review: WorkSessionCorrectionReview,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: work_session_correction_service.review_correction(
            sync_db,
            current_user,
            correction_id,
            review,
        )
    )
