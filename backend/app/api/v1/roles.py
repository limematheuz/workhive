from fastapi import Depends, APIRouter, status
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import ActiveUser, AsyncActiveUser, get_async_db, get_db
from app.api.pagination import PaginationLimit, PaginationOffset
from app.schemas.role import RoleCreate, RoleUpdate, RoleResponse
from app.services import role_service
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=list[RoleResponse])
async def read_roles(
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(lambda sync_db: role_service.get_roles(sync_db, skip, limit))


@router.get("/{role_id}", response_model=RoleResponse)
async def read_role(
    role_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(lambda sync_db: role_service.get_role(sync_db, role_id))


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    role_data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return role_service.create_role(db, role_data, current_user)


@router.patch("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return role_service.update_role(db, role_id, role_data, current_user)
