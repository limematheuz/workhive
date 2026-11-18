from fastapi import APIRouter,Depends,Query
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.quick_work import QuickWorkInput
from app.services import quick_work_service as service
router=APIRouter(prefix="/quick-work")
@router.get("/choices")
def choices(location_id:int|None=Query(default=None,gt=0),db:Session=Depends(get_db),user=ActiveUser):return service.choices(db,user,location_id)
@router.post("",status_code=201)
def create(payload:QuickWorkInput,db:Session=Depends(get_db),user=ActiveUser):return service.create(db,user,payload)

@router.get("/locations")
def locations(q:str=Query(default="",max_length=100),db:Session=Depends(get_db),user=ActiveUser):return service.locations(db,user,q)
