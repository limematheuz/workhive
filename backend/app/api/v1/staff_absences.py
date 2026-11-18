from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, get_db
from app.schemas.staff_absence import AbsenceInput, Absence
from app.services import staff_absence_service as service
from app.schemas.staff_availability import SubstituteSearch, SubstituteAssignment
from app.services import staff_substitution_service

router = APIRouter(prefix="/staff-absences")


@router.post("/candidates/search")
def search_candidates(payload: SubstituteSearch, db: Session = Depends(get_db), current_user=ActiveUser):
    return staff_substitution_service.search(db, current_user, payload)


@router.post("/candidates/assign", response_model=Absence)
def assign_candidate(payload: SubstituteAssignment, db: Session = Depends(get_db), current_user=ActiveUser):
    return staff_substitution_service.assign(db, current_user, payload)


@router.get("", response_model=list[Absence])
def list_absences(db: Session = Depends(get_db), current_user=ActiveUser):
    return service.list_absences(db, current_user)


@router.post("", response_model=Absence, status_code=201)
def register(payload: AbsenceInput, db: Session = Depends(get_db), current_user=ActiveUser):
    return service.save(db, current_user, payload)


@router.put("/{record_id}", response_model=Absence)
def update(record_id: int, payload: AbsenceInput, db: Session = Depends(get_db), current_user=ActiveUser):
    return service.save(db, current_user, payload, record_id)
