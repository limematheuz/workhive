from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, get_db
from app.schemas.service_hours import ContractHours, Approval
from app.services import service_hours_service as service

router = APIRouter(prefix="/service-hours")


@router.get("")
def read_hours(offset: int = 0, db: Session = Depends(get_db), current_user=ActiveUser):
    return service.read_hours(db, current_user, offset)


@router.put("/{task_id}/contract")
def set_contract(task_id: int, payload: ContractHours, db: Session = Depends(get_db), current_user=ActiveUser):
    return service.set_contract(db, current_user, task_id, payload)


@router.post("/{task_id}/approval")
def approve(task_id: int, payload: Approval, db: Session = Depends(get_db), current_user=ActiveUser):
    return service.approve(db, current_user, task_id, payload)


@router.get("/approved-export")
def approved_export(month: str, db: Session = Depends(get_db), current_user=ActiveUser):
    return service.approved_export(db, current_user, month)
