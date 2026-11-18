from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.material_plan import MaterialPlanInput
from app.services import material_plan_service as service

router=APIRouter(prefix="/material-plans")


@router.get("/{order}")
def read(order:int,db:Session=Depends(get_db),user=ActiveUser):
    return service.read(db,user,order)


@router.put("/{order}")
def save(order:int,payload:MaterialPlanInput,db:Session=Depends(get_db),user=ActiveUser):
    return service.save(db,user,order,payload)
