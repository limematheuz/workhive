from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.transaction_currency import CurrencyInput
from app.services import transaction_currency_service as service

router=APIRouter(prefix="/transaction-currency")


@router.get("")
def read(db:Session=Depends(get_db),user=ActiveUser):return service.read(db,user)


@router.post("/{kind}",status_code=201)
def create(kind:str,payload:CurrencyInput,db:Session=Depends(get_db),user=ActiveUser):return service.save(db,user,kind,payload)


@router.put("/{kind}/{id}")
def update(kind:str,id:int,payload:CurrencyInput,db:Session=Depends(get_db),user=ActiveUser):return service.save(db,user,kind,payload,id)
