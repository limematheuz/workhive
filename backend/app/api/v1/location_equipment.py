from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import ActiveUser, get_db
from app.models.user import User
from app.schemas.location_assets import LocationEquipmentLibraryItem
from app.services import location_asset_service


router = APIRouter()


@router.get("", response_model=list[LocationEquipmentLibraryItem])
def read_location_equipment_library(
    db: Session = Depends(get_db), current_user: User = ActiveUser
):
    return [
        LocationEquipmentLibraryItem(
            **equipment.__dict__, location_name=location_name
        )
        for equipment, location_name in location_asset_service.list_equipment_library(
            db, current_user
        )
    ]
