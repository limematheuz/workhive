from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, get_db
from app.schemas.offline_work import OfflineInput, OfflineReview
from app.services import offline_work_service as service

router = APIRouter(prefix="/offline-work")


@router.get("")
def reports(review: bool=False,db: Session=Depends(get_db),user=ActiveUser):
    return service.list_reports(db,user,review)


@router.post("",status_code=201)
def register(payload:OfflineInput,db:Session=Depends(get_db),user=ActiveUser):
    return service.register(db,user,payload)


@router.post("/{report_id}/review")
def review(report_id:int,payload:OfflineReview,db:Session=Depends(get_db),user=ActiveUser):
    return service.review_report(db,user,report_id,payload)
