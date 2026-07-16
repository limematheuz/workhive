from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.role import Role
from app.models.user import User
from app.schemas.role import RoleCreate, RoleUpdate
from app.repositories import role as role_repo
from app.services.user_scope import require_platform_superadmin


def get_roles(db: Session, skip: int = 0, limit: int = 100) -> list[Role]:
    return role_repo.get_roles(db, skip, limit)


def get_role(db: Session, role_id: int) -> Role:
    role = role_repo.get_role(db, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
        )
    return role


def create_role(db: Session, role_data: RoleCreate, current_user: User) -> Role:
    require_platform_superadmin(current_user)
    existing_role = role_repo.get_role_by_name(db, role_data.name)
    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Role already exists"
        )
    return role_repo.create_role(db, role_data)


def update_role(
    db: Session,
    role_id: int,
    role_data: RoleUpdate,
    current_user: User,
) -> Role:
    require_platform_superadmin(current_user)
    db_role = get_role(db, role_id)
    return role_repo.update_role(db, db_role, role_data)
