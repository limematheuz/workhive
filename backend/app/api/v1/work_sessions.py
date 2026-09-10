from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, status, APIRouter, Query
from app.api.pagination import PaginationLimit, PaginationOffset
from app.api.deps import (
    ActiveUser,
    AsyncActiveUser,
    get_async_db,
    get_db,
)
from app.services import work_session_service
from app.services import organization_authorization_service
from app.models.user import User
from app.schemas.work_session import (
    WorkSessionCreate,
    WorkSessionEnd,
    WorkSessionResponse,
    ActiveCompanySessionResponse,
    TaskWorkSummaryResponse,
    TaskWorkDetailedSummaryResponse,
    TaskWorkDetailedSummariesResponse,
)

router = APIRouter()


@router.get("/", response_model=list[WorkSessionResponse])
async def read_work_sessions(
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: work_session_service.get_work_sessions(
            sync_db,
            current_user.id,
            skip,
            limit,
            organization_authorization_service.permitted_location_ids(
                sync_db,
                current_user,
                "time.manage",
            ),
        )
    )


@router.get("/active", response_model=WorkSessionResponse | None)
async def active_work_session(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    def operation(sync_db: Session):
        active_session = work_session_service.get_active_session(
            sync_db,
            current_user.id,
        )
        if active_session:
            organization_authorization_service.require_capability(
                sync_db,
                current_user,
                "time.manage",
                scope_type=(
                    "location" if active_session.location_id is not None else "company"
                ),
                scope_id=active_session.location_id,
            )
        return active_session

    return await db.run_sync(operation)


@router.get("/company/active", response_model=list[ActiveCompanySessionResponse])
async def active_company_sessions(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: work_session_service.get_active_company_sessions(
            sync_db,
            current_user,
            organization_authorization_service.permitted_location_ids(
                sync_db,
                current_user,
                "time.read",
            ),
        )
    )


@router.get("/task/{task_item_id}/summary", response_model=TaskWorkSummaryResponse)
async def task_work_summary(
    task_item_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: work_session_service.get_task_work_summary(
            sync_db,
            current_user,
            task_item_id,
        )
    )


@router.get(
    "/task/{task_item_id}/detailed-summary",
    response_model=TaskWorkDetailedSummaryResponse,
)
async def task_work_detailed_summary(
    task_item_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: work_session_service.get_task_work_detailed_summary(
            sync_db,
            current_user,
            task_item_id,
        )
    )


@router.get(
    "/tasks/detailed-summaries",
    response_model=TaskWorkDetailedSummariesResponse,
)
async def task_work_detailed_summaries(
    task_item_ids: list[int] = Query(min_length=1, max_length=100),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    summaries = await db.run_sync(
        lambda sync_db: work_session_service.get_task_work_detailed_summaries(
            sync_db,
            current_user,
            task_item_ids,
        )
    )
    return {"summaries": summaries}


@router.get("/{session_id}", response_model=WorkSessionResponse)
async def read_work_session(
    session_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: work_session_service.get_work_session(
            sync_db,
            session_id,
            current_user.id,
            organization_authorization_service.permitted_location_ids(
                sync_db,
                current_user,
                "time.manage",
            ),
        )
    )


@router.post(
    "/start", response_model=WorkSessionResponse, status_code=status.HTTP_201_CREATED
)
def start_work_session(
    session_data: WorkSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return work_session_service.start_work_session(db, current_user.id, session_data)


@router.post(
    "/stop", response_model=WorkSessionResponse, status_code=status.HTTP_200_OK
)
def stop_work_session(
    end_data: WorkSessionEnd | None = None,
    db: Session = Depends(get_db), current_user: User = ActiveUser
):
    return work_session_service.end_work_session(
        db,
        current_user.id,
        current_user=current_user,
        end_data=end_data,
    )
