from fastapi import APIRouter,Depends,Path
from sqlalchemy.orm import Session
from app.api.deps import ActiveApplicationUser,get_db
from app.schemas.accounting_period import PeriodDecision
from app.services import accounting_period_service as service

router=APIRouter(prefix="/accounting-periods")


@router.get("/{company_id}/{month}")
def read(company_id:int,month:str=Path(pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$"),db:Session=Depends(get_db),user=ActiveApplicationUser):
    return service.read(db,user,company_id,month)


@router.post("/{company_id}/{month}/close")
def close(payload:PeriodDecision,company_id:int,month:str,db:Session=Depends(get_db),user=ActiveApplicationUser):
    return service.change(db,user,company_id,month,payload,"close")


@router.post("/{company_id}/{month}/reopen")
def reopen(payload:PeriodDecision,company_id:int,month:str,db:Session=Depends(get_db),user=ActiveApplicationUser):
    return service.change(db,user,company_id,month,payload,"reopen")
