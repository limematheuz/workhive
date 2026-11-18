from decimal import Decimal
from typing import Literal
from fastapi import APIRouter,Depends,Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.services import management_insights_service as service
router=APIRouter(prefix="/management-insights")


@router.get("")
def read(month:str|None=Query(default=None,pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$"),period:Literal["month","year"]="month",db:Session=Depends(get_db),user=ActiveUser):return jsonable_encoder(service.read(db,user,month,period),custom_encoder={Decimal:str})
