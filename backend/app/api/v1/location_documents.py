from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.models.user import User
from app.schemas.location_assets import LocationDocumentLibraryItem
from app.services import location_asset_service


router = APIRouter()


@router.get("", response_model=list[LocationDocumentLibraryItem])
def read_location_document_library(
    db: Session = Depends(get_db), current_user: User = ActiveUser
):
    return [
        LocationDocumentLibraryItem(
            **document.__dict__, location_name=location_name
        )
        for document, location_name in location_asset_service.list_document_library(
            db, current_user
        )
    ]
