from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.workforce_plan import ProgressInput
from app.services import workforce_execution_service as service
router=APIRouter(prefix="/workforce-execution")


@router.get("/{task_id}")
def read(task_id:int,db:Session=Depends(get_db),user=ActiveUser):return service.read(db,user,task_id)


@router.put("/{task_id}/{allocation_id}/{checklist_id}")
def mark(task_id:int,allocation_id:int,checklist_id:int,payload:ProgressInput,db:Session=Depends(get_db),user=ActiveUser):return service.mark(db,user,task_id,allocation_id,checklist_id,payload.completed,payload.answer)
