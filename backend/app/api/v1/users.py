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
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    ActiveUser,
    ActiveApplicationUser,
    AsyncActiveUser,
    AsyncAuthenticatedUser,
    get_async_db,
    get_db,
)
from app.api.pagination import PaginationLimit, PaginationOffset
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.user import UserResponse, UserStatsResponse, UserUpdate
from app.services.image_service import MAX_IMAGE_BYTES, store_image
from app.services import user_service
from app.services import audit_service
from app.services import organization_authorization_service
from app.services.subscription_policy import require_company_access

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def read_current_user(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncAuthenticatedUser,
):
    """Return the signed-in identity without opening a tenant workspace.

    A sponsored partner portal has a valid session but deliberately does not
    have access to its own company's paid workspace.  The client needs this
    minimal identity to route the user into that separate portal.
    """
    if current_user.role.name != "partner_portal" and current_user.company:
        require_company_access(current_user.company)
    return await db.run_sync(
        lambda sync_db: _current_user_response(sync_db, current_user)
    )


def _current_user_response(db: Session, current_user: User) -> UserResponse:
    response = UserResponse.model_validate(current_user)
    if current_user.role.name == "partner_portal" or current_user.company_id is None:
        return response
    return response.model_copy(
        update={
            "can_view_finance": organization_authorization_service.has_capability(
                db, current_user, "finance.read"
            ),
            "can_manage_finance": organization_authorization_service.has_capability(
                db, current_user, "finance.manage"
            ),
            "can_manage_time": organization_authorization_service.has_capability(
                db, current_user, "time.manage"
            ),
            "can_approve_time": organization_authorization_service.has_capability(
                db, current_user, "time.approve"
            ),
        }
    )


@router.get("/", response_model=list[UserResponse])
async def read_all_users(
    skip: PaginationOffset = 0,
    limit: PaginationLimit = 100,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: user_service.get_users(
            sync_db,
            current_user,
            skip,
            limit,
        )
    )


@router.get("/{user_id}", response_model=UserResponse)
async def read_user(
    user_id: int,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: user_service.get_user(sync_db, user_id, current_user)
    )


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
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
def upload_user_photo(
    user_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    enforce_rate_limit(
        request,
        "profile-photo-upload",
        settings.MEDIA_UPLOAD_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(current_user.id),
    )
    db_user = user_service.get_user(db, user_id, current_user)

    if current_user.id != user_id:
        from app.services.organization_authorization_service import require_capability

        require_capability(db, current_user, "access.members.manage")

    contents = file.file.read(MAX_IMAGE_BYTES + 1)
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
async def read_user_stats(
    user_id: int,
    time_range: str | None = None,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncActiveUser,
):
    return await db.run_sync(
        lambda sync_db: user_service.get_user_stats(
            sync_db,
            user_id,
            current_user,
            time_range,
        )
    )


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
