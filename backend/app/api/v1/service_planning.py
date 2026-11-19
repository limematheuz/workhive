from fastapi import APIRouter,Depends,Query
from pydantic import BaseModel,Field
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.workforce_plan import CrewInput,ServicePlanInput,SpaceAllocation
from app.schemas.work_order import WorkOrderResponse
from app.services import service_planning_service as service,work_crew_service as crews
router=APIRouter()


class PlannedServiceResponse(BaseModel):
    work_order:WorkOrderResponse
    task_id:int|None
    space_count:int


class ScopeInput(BaseModel):
    spaces:list[SpaceAllocation]=Field(min_length=1,max_length=100)


@router.get("/work-crews")
def read_crews(db:Session=Depends(get_db),user=ActiveUser):return crews.read(db,user)


@router.post("/work-crews",status_code=201)
def create_crew(payload:CrewInput,db:Session=Depends(get_db),user=ActiveUser):return crews.save(db,user,payload)


@router.put("/work-crews/{crew_id}")
def edit_crew(crew_id:int,payload:CrewInput,db:Session=Depends(get_db),user=ActiveUser):return crews.save(db,user,payload,crew_id)


@router.get("/service-planning/choices")
def choices(location_id:int=Query(ge=1),db:Session=Depends(get_db),user=ActiveUser):return service.choices(db,user,location_id)


@router.get("/service-planning/contract-scope")
def contract_scope(contract_id:int=Query(ge=1),location_id:int=Query(ge=1),db:Session=Depends(get_db),user=ActiveUser):return service.contract_scope(db,user,contract_id,location_id)


@router.post("/service-planning",response_model=PlannedServiceResponse,status_code=201)
def create(payload:ServicePlanInput,db:Session=Depends(get_db),user=ActiveUser):return service.create(db,user,payload)


@router.get("/service-planning/{order_id}")
def read_scope(order_id:int,db:Session=Depends(get_db),user=ActiveUser):return service.read_scope(db,user,order_id)


@router.put("/service-planning/{order_id}")
def save_scope(order_id:int,payload:ScopeInput,db:Session=Depends(get_db),user=ActiveUser):return service.save_scope(db,user,order_id,payload.spaces)
