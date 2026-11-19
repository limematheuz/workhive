from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.internal_request import RequestInput,RequestReview
from app.services import internal_request_service as service

router=APIRouter(prefix="/internal-requests")


@router.get("/choices")
def choices(db:Session=Depends(get_db),user=ActiveUser):
    return service.choices(db,user)


@router.get("")
def requests(review:bool=False,db:Session=Depends(get_db),user=ActiveUser):
    return service.list_requests(db,user,review)


@router.post("",status_code=201)
def create(payload:RequestInput,db:Session=Depends(get_db),user=ActiveUser):
    return service.create(db,user,payload)


@router.post("/{item_id}/review")
def review(item_id:int,payload:RequestReview,db:Session=Depends(get_db),user=ActiveUser):
    return service.decide(db,user,item_id,payload)


@router.get("/access")
def access(db:Session=Depends(get_db),user=ActiveUser):return service.access(db,user)
