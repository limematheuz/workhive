"""Bounded global search; tenant selectors are never accepted from the caller."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, get_db
from app.schemas.staff import Employee
from app.schemas.workspace_search import SearchType, WorkspaceSearch
from app.services import workspace_search_service as service

router = APIRouter()


@router.get("/workspace-search", response_model=WorkspaceSearch)
def search(q: str = Query(min_length=2, max_length=120), types: list[SearchType] | None = Query(default=None),
        limit_per_type: int = Query(default=5, ge=1, le=5), db: Session = Depends(get_db), user=ActiveUser):
    return service.search(db, user, q, types, limit_per_type)


@router.get("/staff/{employee_id}", response_model=Employee)
def employee(employee_id: int, db: Session = Depends(get_db), user=ActiveUser):
    return service.staff_detail(db, user, employee_id)
