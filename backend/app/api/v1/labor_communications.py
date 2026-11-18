from fastapi import APIRouter,Depends,Query
from sqlalchemy.orm import Session
from app.api.deps import ActiveApplicationUser,get_db
from app.schemas.labor_communication import LaborCommunicationInput,LaborCommunicationDecision
from app.services import labor_communication_service as service

router=APIRouter(prefix="/labor-communications")


@router.get("/{company}")
def read(company:int,offset:int=Query(0,ge=0),db:Session=Depends(get_db),user=ActiveApplicationUser):return service.read(db,user,company,offset)


@router.post("/{company}",status_code=201)
def create(company:int,payload:LaborCommunicationInput,db:Session=Depends(get_db),user=ActiveApplicationUser):return service.create(db,user,company,payload)


@router.post("/{company}/{id}/status")
def decide(company:int,id:int,payload:LaborCommunicationDecision,db:Session=Depends(get_db),user=ActiveApplicationUser):return service.decide(db,user,company,id,payload)
