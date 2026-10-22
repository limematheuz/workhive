from fastapi import APIRouter, File, HTTPException, Request, Response, UploadFile, status

from app.api.deps import ActiveUser
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.services.image_service import MAX_IMAGE_BYTES, store_image
from app.services.storage_service import (
    ObjectNotFoundError,
    get_object_storage,
    normalize_key,
)
from app.services.user_scope import is_platform_superadmin

router = APIRouter()
ALLOWED_FOLDERS = {"company", "signature", "profile", "general", "location"}


@router.post("/", status_code=status.HTTP_201_CREATED)
def upload_file(
    request: Request,
    folder: str = "general",
    file: UploadFile = File(...),
    current_user: User = ActiveUser,
):
    enforce_rate_limit(
        request,
        "media-upload",
        settings.MEDIA_UPLOAD_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(current_user.id),
    )
    if folder not in ALLOWED_FOLDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid folder name",
        )

    if current_user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A company is required to store media",
        )
    contents = file.file.read(MAX_IMAGE_BYTES + 1)
    return {
        "url": store_image(
            contents,
            company_id=current_user.company_id,
            folder=folder,
        )
    }


@router.get("/media/{key:path}")
def read_media(
    key: str,
    current_user: User = ActiveUser,
):
    try:
        normalized = normalize_key(key)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found",
        ) from error

    # Quality evidence is only readable through its inspection or incident route,
    # where the feature entitlement and location capability are both checked.
    key_parts = normalized.split("/", 3)
    if len(key_parts) >= 3 and key_parts[0] == "company" and key_parts[2] in {"quality-evidence", "expense-receipts"}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found",
        )

    company_prefix = f"company/{current_user.company_id}/"
    if (
        not is_platform_superadmin(current_user)
        and not normalized.startswith(company_prefix)
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found",
        )
    try:
        stored = get_object_storage().get(normalized)
    except ObjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found",
        ) from None
    return Response(
        content=stored.contents,
        media_type=stored.content_type,
        headers={"Cache-Control": "private, no-store"},
    )
