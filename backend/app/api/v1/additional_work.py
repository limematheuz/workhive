from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, get_db
from app.schemas.additional_work import WorkRequest, QuoteLink, Schedule
from app.services import additional_work_service as service

router = APIRouter(prefix="/additional-work")


@router.get("")
def list_requests(db: Session = Depends(get_db), user=ActiveUser):
    return service.list_requests(db, user)


@router.post("", status_code=201)
def create(payload: WorkRequest, db: Session = Depends(get_db), user=ActiveUser):
    return service.create(db, user, payload)


@router.put("/{item_id}/quote")
def link_quote(item_id: int, payload: QuoteLink, db: Session = Depends(get_db), user=ActiveUser):
    return service.link_quote(db, user, item_id, payload)


@router.post("/{item_id}/schedule")
def schedule(item_id: int, payload: Schedule, db: Session = Depends(get_db), user=ActiveUser):
    return service.schedule(db, user, item_id, payload)
