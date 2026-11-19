from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session
from app.api.deps import ActiveApplicationUser, get_db
from app.schemas.record_history import RecordEntity, RecordHistoryResponse
from app.services import record_history_service

router = APIRouter(prefix="/record-history")


@router.get("/{entity_type}/{identifier}", response_model=RecordHistoryResponse)
def read_history(entity_type: RecordEntity, identifier: int = Path(ge=1), offset: int = Query(0, ge=0, le=100000), db: Session = Depends(get_db), user=ActiveApplicationUser):
    return record_history_service.read(db, user, entity_type, identifier, offset)
