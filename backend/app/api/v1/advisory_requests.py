from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveApplicationUser,get_db
from app.schemas.advisory_request import AdvisoryRequestInput,AdvisoryResponse
from app.services import advisory_request_service as service
router=APIRouter(prefix="/advisory-requests")


@router.get("/{company}")
def read(company:int,db:Session=Depends(get_db),user=ActiveApplicationUser):return service.read(db,user,company)


@router.post("/{company}",status_code=201)
def create(company:int,payload:AdvisoryRequestInput,db:Session=Depends(get_db),user=ActiveApplicationUser):return service.create(db,user,company,payload)


@router.put("/{company}/{record_id}")
def answer(company:int,record_id:int,payload:AdvisoryResponse,db:Session=Depends(get_db),user=ActiveApplicationUser):return service.answer(db,user,company,record_id,payload)
