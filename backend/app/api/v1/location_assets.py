from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.user import User
from app.schemas.location_assets import (
    LocationDocumentResponse,
    LocationEquipmentInput,
    LocationEquipmentResponse,
    LocationEquipmentUpdate,
)
from app.services import location_access_service, location_asset_service
from app.services.user_scope import scoped_company_id


router = APIRouter()


@router.get("/{location_id}/documents", response_model=list[LocationDocumentResponse])
def read_location_documents(location_id: int, db: Session = Depends(get_db), current_user: User = ActiveUser):
    location_access_service.require_readable_location(db, current_user, location_id)
    return location_asset_service.list_documents(db, location_id)


@router.post("/{location_id}/documents", response_model=LocationDocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_location_document(
    location_id: int,
    request: Request,
    file: UploadFile = File(...),
    document_type: str = Form(default="other"),
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    enforce_rate_limit(
        request,
        "location-document-upload",
        settings.MEDIA_UPLOAD_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(current_user.id),
    )
    location_access_service.require_location_owner(db, current_user, location_id)
    return location_asset_service.upload_document(
        db,
        location_id=location_id,
        company_id=scoped_company_id(current_user),
        current_user=current_user,
        filename=file.filename,
        content_type=file.content_type,
        contents=file.file.read(
            min(
                location_asset_service.document_storage_limit(
                    db, scoped_company_id(current_user)
                ),
                location_asset_service.ABSOLUTE_MAX_DOCUMENT_BYTES,
            )
            + 1
        ),
        document_type=document_type,
    )


@router.get("/{location_id}/documents/{document_id}/download")
def download_location_document(location_id: int, document_id: int, db: Session = Depends(get_db), current_user: User = ActiveUser):
    location_access_service.require_readable_location(db, current_user, location_id)
    document, contents = location_asset_service.get_document_contents(db, location_id, document_id)
    filename = document.name.replace('"', "")
    return Response(
        content=contents,
        media_type=document.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-store",
        },
    )


@router.delete("/{location_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_location_document(location_id: int, document_id: int, db: Session = Depends(get_db), current_user: User = ActiveUser):
    location_access_service.require_location_owner(db, current_user, location_id)
    location_asset_service.archive_document(db, location_id, document_id)


@router.get("/{location_id}/equipment", response_model=list[LocationEquipmentResponse])
def read_location_equipment(location_id: int, db: Session = Depends(get_db), current_user: User = ActiveUser):
    location_access_service.require_readable_location(db, current_user, location_id)
    return location_asset_service.list_equipment(db, location_id)


@router.post("/{location_id}/equipment", response_model=LocationEquipmentResponse, status_code=status.HTTP_201_CREATED)
def create_location_equipment(location_id: int, payload: LocationEquipmentInput, db: Session = Depends(get_db), current_user: User = ActiveUser):
    location_access_service.require_location_owner(db, current_user, location_id)
    return location_asset_service.create_equipment(db, location_id=location_id, company_id=scoped_company_id(current_user), data=payload)


@router.patch("/{location_id}/equipment/{equipment_id}", response_model=LocationEquipmentResponse)
def update_location_equipment(location_id: int, equipment_id: int, payload: LocationEquipmentUpdate, db: Session = Depends(get_db), current_user: User = ActiveUser):
    location_access_service.require_location_owner(db, current_user, location_id)
    return location_asset_service.update_equipment(db, location_id=location_id, equipment_id=equipment_id, data=payload)


@router.delete("/{location_id}/equipment/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_location_equipment(location_id: int, equipment_id: int, db: Session = Depends(get_db), current_user: User = ActiveUser):
    location_access_service.require_location_owner(db, current_user, location_id)
    location_asset_service.archive_equipment(db, location_id, equipment_id)
