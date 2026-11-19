from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, get_db
from app.schemas.staff import EmployeeInput, Employee
from app.services import staff_service as service

router = APIRouter(prefix="/staff")


@router.get("", response_model=list[Employee])
def list_staff(db: Session = Depends(get_db), current_user=ActiveUser):
    return service.list_staff(db, current_user)


@router.post("", response_model=Employee, status_code=201)
def create_staff(payload: EmployeeInput, db: Session = Depends(get_db), current_user=ActiveUser):
    return service.create_staff(payload, db, current_user)


@router.put("/{employee_id}", response_model=Employee)
def edit_staff(employee_id: int, payload: EmployeeInput, db: Session = Depends(get_db), current_user=ActiveUser):
    return service.edit_staff(employee_id, payload, db, current_user)
