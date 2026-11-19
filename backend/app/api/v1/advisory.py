from fastapi import File,UploadFile,APIRouter, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.api.deps import ActiveApplicationUser, get_db
from app.services import advisory_service as service

router = APIRouter(prefix="/advisory")


class GrantInput(BaseModel):
    email: EmailStr
    accounting: bool
    payroll: bool
    can_close_periods: bool = False


@router.get("/companies")
def companies(db: Session = Depends(get_db), user=ActiveApplicationUser):
    return service.companies(db, user)


@router.get("/grants")
def grants(db: Session = Depends(get_db), user=ActiveApplicationUser):
    return service.list_grants(db, user)


@router.put("/grants")
def save(payload: GrantInput, db: Session = Depends(get_db), user=ActiveApplicationUser):
    return service.save_grant(db, user, payload)


@router.get("/{company_id}/payroll")
def payroll(company_id: int, month: str, db: Session = Depends(get_db), user=ActiveApplicationUser):
    return service.payroll(db, user, company_id, month)


@router.get("/{company_id}/accounting")
def accounting(company_id: int, year: int = Query(ge=2000,le=9998), db: Session = Depends(get_db), user=ActiveApplicationUser):
    export = service.accounting_export(db, user, company_id, year)
    return Response(export.content, media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{export.filename}"'})


@router.get("/{company_id}/payroll-export")
def payroll_export(company_id: int, month: str, db: Session = Depends(get_db), user=ActiveApplicationUser):
    return service.payroll_export(db, user, company_id, month)


@router.post("/{company_id}/staff/{employee_id}/payroll",status_code=201)
def deliver_payroll(company_id:int,employee_id:int,month:str,file:UploadFile=File(...),db:Session=Depends(get_db),user=ActiveApplicationUser):
    from app.services.staff_document_file_service import deliver_payroll
    return deliver_payroll(db,user,company_id,employee_id,month,file.filename,file.content_type,file.file.read(20_000_001))
