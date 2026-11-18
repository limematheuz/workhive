from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.operations_automation import AutomationInput
from app.services import operations_automation_service as service

router=APIRouter(prefix="/operations-automation")


@router.get("")
def read(db:Session=Depends(get_db),user=ActiveUser):
    return service.read(db,user)


@router.put("")
def save(payload:AutomationInput,db:Session=Depends(get_db),user=ActiveUser):
    return service.save(db,user,payload)


@router.post("/run")
def run(db:Session=Depends(get_db),user=ActiveUser):
    return service.run(db,user)
