from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.resource_log import VehicleInput,JourneyInput,CustodyInput
from app.services import resource_log_service as service

router = APIRouter(prefix="/resource-log")


@router.get("")
def overview(db:Session=Depends(get_db),user=ActiveUser):
    return service.overview(db,user)


@router.post("/vehicles",status_code=201)
def vehicle(payload:VehicleInput,db:Session=Depends(get_db),user=ActiveUser):
    return service.vehicle(db,user,payload)


@router.put("/vehicles/{record_id}")
def edit_vehicle(record_id:int,payload:VehicleInput,db:Session=Depends(get_db),user=ActiveUser):
    return service.vehicle(db,user,payload,record_id)


@router.post("/journeys",status_code=201)
def journey(payload:JourneyInput,db:Session=Depends(get_db),user=ActiveUser):
    return service.journey(db,user,payload)


@router.post("/custody",status_code=201)
def deliver(payload:CustodyInput,db:Session=Depends(get_db),user=ActiveUser):
    return service.deliver(db,user,payload)


@router.post("/custody/{record_id}/return")
def give_back(record_id:int,db:Session=Depends(get_db),user=ActiveUser):
    return service.give_back(db,user,record_id)
