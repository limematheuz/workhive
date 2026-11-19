from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.subcontract import SubcontractInput,SubcontractReview
from app.services import subcontract_service as service
router=APIRouter(prefix="/subcontracts")


@router.get("")
def read(db:Session=Depends(get_db),user=ActiveUser):return service.read(db,user)


@router.post("",status_code=201)
def create(payload:SubcontractInput,db:Session=Depends(get_db),user=ActiveUser):return service.save(db,user,payload)


@router.put("/{record_id}")
def save(record_id:int,payload:SubcontractInput,db:Session=Depends(get_db),user=ActiveUser):return service.save(db,user,payload,record_id)


@router.post("/{record_id}/review")
def review(record_id:int,payload:SubcontractReview,db:Session=Depends(get_db),user=ActiveUser):return service.review(db,user,record_id,payload)
