from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.quote_cost_estimate import QuoteCostInput
from app.services import quote_cost_estimate_service as service

router=APIRouter(prefix="/quote-cost-estimates")


@router.get("/{quote_id}")
def read(quote_id:int,db:Session=Depends(get_db),user=ActiveUser):
    return service.read(db,user,quote_id)


@router.put("/{quote_id}")
def save(quote_id:int,payload:QuoteCostInput,db:Session=Depends(get_db),user=ActiveUser):
    return service.save(db,user,quote_id,payload)
