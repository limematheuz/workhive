from fastapi import Depends, APIRouter, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, ActiveUser, ActiveAdmin, require_role
from app.schemas.role import RoleCreate, RoleUpdate, RoleResponse
from app.services import role_service
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=list[RoleResponse])
def read_roles(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return role_service.get_roles(db, skip, limit)


@router.get("/{role_id}", response_model=RoleResponse)
def read_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    return role_service.get_role(db, role_id)


@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    role_data: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("superadmin")),
):
    return role_service.create_role(db, role_data)


@router.patch("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("superadmin")),

):
    return role_service.update_role(db, role_id, role_data)
