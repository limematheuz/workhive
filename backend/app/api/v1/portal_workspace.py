from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, get_db
from app.schemas.portal_workspace import PortalWorkspace
from app.services import portal_workspace_service as service
router = APIRouter(prefix='/portal-workspace')

@router.get('', response_model=PortalWorkspace)
def read(search: str=Query('', max_length=120), offset: int=Query(0, ge=0), db: Session=Depends(get_db), user=ActiveUser):
    return service.read(db, user, search.strip(), offset)
