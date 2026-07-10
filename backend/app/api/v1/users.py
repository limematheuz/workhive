from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.api.deps import ActiveManagerOrAdmin, ActiveUser, get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserStatsResponse, UserUpdate
from app.services.image_service import MAX_IMAGE_BYTES, store_image
from app.services import user_service
from app.services import audit_service

router = APIRouter()


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = ActiveUser):
    return current_user


@router.get("/", response_model=list[UserResponse])
def read_all_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    return user_service.get_users(db, current_user.company_id, skip, limit)


@router.get("/{user_id}", response_model=UserResponse)
def read_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    return user_service.get_user(db, user_id, current_user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    updated_user = user_service.update_user(
        db, user_id, user_update, current_user
    )
    changed_fields = sorted(
        field
        for field in user_update.model_fields_set
        if field not in {"password", "old_password"}
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=updated_user.company_id,
        action="user.updated",
        entity_type="user",
        entity_id=updated_user.id,
        request=request,
        details={"changed_fields": changed_fields},
    )
    return updated_user


@router.post("/{user_id}/photo", response_model=UserResponse)
async def upload_user_photo(
    user_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    db_user = user_service.get_user(db, user_id, current_user)

    if current_user.id != user_id and current_user.role.name not in ["superadmin", "admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update this user's photo",
        )

    contents = await file.read(MAX_IMAGE_BYTES + 1)
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds the maximum allowed size of 4MB",
        )
    if db_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A company is required to store a profile photo",
        )
    db_user.photo_url = store_image(
        contents,
        company_id=db_user.company_id,
        folder="profile",
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=db_user.company_id,
        action="user.photo_updated",
        entity_type="user",
        entity_id=db_user.id,
        request=request,
    )
    return db_user


@router.get("/{user_id}/stats", response_model=UserStatsResponse)
def read_user_stats(
    user_id: int,
    time_range: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser
):
    return user_service.get_user_stats(db, user_id, current_user, time_range)


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_worker(
    worker_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    worker = user_service.create_worker(db, worker_data, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=worker.company_id,
        action="user.created",
        entity_type="user",
        entity_id=worker.id,
        request=request,
        details={
            "role_id": worker.role_id,
            "is_active": worker.is_active,
        },
    )
    return worker


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    user_service.delete_user_permanently(db, user_id, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="user.deleted",
        entity_type="user",
        entity_id=user_id,
        request=request,
    )
    return None
