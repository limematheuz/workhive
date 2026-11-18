from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, get_db
from app.schemas.task_space_scope import TaskSpaceScopeInput, TaskSpaceScopeResponse
from app.services import task_space_scope_service as service

router = APIRouter(prefix="/workforce-execution")


@router.get("/{task_id}/scope", response_model=TaskSpaceScopeResponse)
def read(task_id: int, db: Session = Depends(get_db), user=ActiveUser):
    return service.read(db, user, task_id)


@router.put("/{task_id}/scope", response_model=TaskSpaceScopeResponse)
def save(task_id: int, payload: TaskSpaceScopeInput, db: Session = Depends(get_db), user=ActiveUser):
    return service.save(db, user, task_id, payload)
