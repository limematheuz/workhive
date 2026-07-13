from sqlalchemy.orm import Session
from fastapi import Depends, status, APIRouter
from app.api.deps import get_db, ActiveUser, ActiveManagerOrAdmin
from app.services import work_session_service
from app.models.user import User
from app.schemas.work_session import (
    WorkSessionCreate,
    WorkSessionResponse,
    ActiveCompanySessionResponse,
    TaskWorkSummaryResponse,
    TaskWorkDetailedSummaryResponse,
)

router = APIRouter()


@router.get("/", response_model=list[WorkSessionResponse])
def read_work_sessions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return work_session_service.get_work_sessions(db, current_user.id, skip, limit)


@router.get("/active", response_model=WorkSessionResponse | None)
def active_work_session(
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return work_session_service.get_active_session(db, current_user.id)


@router.get("/company/active", response_model=list[ActiveCompanySessionResponse])
def active_company_sessions(
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    return work_session_service.get_active_company_sessions(db, current_user)


@router.get("/task/{task_item_id}/summary", response_model=TaskWorkSummaryResponse)
def task_work_summary(
    task_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return work_session_service.get_task_work_summary(
        db, current_user, task_item_id
    )


@router.get(
    "/task/{task_item_id}/detailed-summary",
    response_model=TaskWorkDetailedSummaryResponse,
)
def task_work_detailed_summary(
    task_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return work_session_service.get_task_work_detailed_summary(
        db, current_user, task_item_id
    )


@router.get("/{session_id}", response_model=WorkSessionResponse)
def read_work_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return work_session_service.get_work_session(db, session_id, current_user.id)


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
    db: Session = Depends(get_db), current_user: User = ActiveUser
):
    return work_session_service.end_work_session(db, current_user.id)
