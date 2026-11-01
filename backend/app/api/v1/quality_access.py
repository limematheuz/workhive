from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import ActiveApplicationUser, get_db
from app.models.user import User
from app.schemas.quality_access import QualityWorkspaceAccess
from app.services.quality_workspace_access_service import quality_workspace_access


router = APIRouter()


@router.get("", response_model=QualityWorkspaceAccess)
def read_quality_access(
    db: Session = Depends(get_db), current_user: User = ActiveApplicationUser
):
    return quality_workspace_access(db, current_user)
