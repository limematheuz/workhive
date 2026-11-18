from fastapi import APIRouter,Depends,Query,Response
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.saved_report import ReportInput
from app.services import saved_report_service as service
router=APIRouter(prefix="/custom-reports")


@router.get("")
def read(db:Session=Depends(get_db),user=ActiveUser):return service.read(db,user)


@router.post("",status_code=201)
def save(payload:ReportInput,db:Session=Depends(get_db),user=ActiveUser):return service.save(db,user,payload)


@router.post("/run")
def run(payload:ReportInput,offset:int=Query(0,ge=0),db:Session=Depends(get_db),user=ActiveUser):return service.run(db,user,payload,offset)


@router.delete("/{record_id}",status_code=204)
def remove(record_id:int,db:Session=Depends(get_db),user=ActiveUser):service.remove(db,user,record_id)


@router.get("/{record_id}/export")
def export(record_id:int,offset:int=Query(0,ge=0),db:Session=Depends(get_db),user=ActiveUser):
    return Response(service.export(db,user,record_id,offset),media_type="text/csv; charset=utf-8",headers={"Content-Disposition":"attachment; filename=informe.csv"})
