from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.services import staff_documentation_service as service

router=APIRouter(prefix="/staff-documentation")


@router.get("")
def documents(own:bool=False,db:Session=Depends(get_db),user=ActiveUser):
    return service.documents(db,user,own)


@router.post("/{digest}/acknowledge")
def acknowledge(digest:str,db:Session=Depends(get_db),user=ActiveUser):
    return service.acknowledge(db,user,digest)
