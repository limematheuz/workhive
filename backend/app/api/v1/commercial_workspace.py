from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, get_db
from app.schemas.client_sales import OpportunityStage
from app.schemas.commercial_workspace import CommercialWorkspace, CommercialAccount
from app.services import commercial_workspace_service as service
router = APIRouter(prefix='/commercial-workspace')

@router.get('', response_model=CommercialWorkspace)
def read(search: str=Query('', max_length=120), stage: OpportunityStage | None=None, attention: bool=False, offset: int=Query(0, ge=0), db: Session=Depends(get_db), user=ActiveUser):
    return service.read(db, user, search.strip(), stage, attention, offset)

@router.get('/accounts', response_model=list[CommercialAccount])
def accounts(search: str=Query('', max_length=120), db: Session=Depends(get_db), user=ActiveUser):
    return service.accounts(db, user, search.strip())
