from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, get_db
from app.services import worker_workspace_service

router = APIRouter(prefix="/worker-workspace")


@router.get("")
def own_workspace(db: Session = Depends(get_db), user=ActiveUser):
    return worker_workspace_service.context(db, user)
