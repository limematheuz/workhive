from fastapi import APIRouter, Depends,Query
from datetime import datetime
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, get_db
from app.schemas.staff_shift import ShiftInput
from app.services import staff_shift_service as service

router = APIRouter(prefix="/staff-shifts")


@router.get("")
def shifts(db: Session = Depends(get_db), user=ActiveUser):
    return service.list_shifts(db, user)


@router.post("", status_code=201)
def create(payload: ShiftInput, db: Session = Depends(get_db), user=ActiveUser):
    return service.save(db, user, payload)


@router.put("/{shift_id}")
def edit(shift_id: int, payload: ShiftInput, db: Session = Depends(get_db), user=ActiveUser):
    return service.save(db, user, payload, shift_id)


@router.get("/roster")
def roster(start:datetime,end:datetime,offset:int=Query(0,ge=0),db:Session=Depends(get_db),user=ActiveUser):
    from app.services.staff_roster_service import read
    return read(db,user,start,end,offset)
