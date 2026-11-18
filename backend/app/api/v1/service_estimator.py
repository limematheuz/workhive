from decimal import Decimal
from fastapi import APIRouter,Depends,Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.service_estimator import EstimateInput,EstimateQuoteInput
from app.services import service_estimator_service as service,estimator_quote_service as quotes
router=APIRouter(prefix="/service-estimator")


def encoded(value):return jsonable_encoder(value,custom_encoder={Decimal:str})


@router.get("/options")
def options(location_id:int|None=Query(default=None,ge=1),opportunity_id:int|None=Query(default=None,ge=1),db:Session=Depends(get_db),user=ActiveUser):return encoded(service.options(db,user,location_id,opportunity_id))


@router.post("/preview")
def preview(payload:EstimateInput,db:Session=Depends(get_db),user=ActiveUser):return encoded(service.preview(db,user,payload))


@router.post("/quotes",status_code=201)
def create_quote(payload:EstimateQuoteInput,db:Session=Depends(get_db),user=ActiveUser):return encoded(quotes.create(db,user,payload))
