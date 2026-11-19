from fastapi import APIRouter,Depends,Query,Response
from sqlalchemy.orm import Session
from app.api.deps import ActiveApplicationUser,get_db
from app.services import advisory_accounting_service as service
router=APIRouter(prefix="/advisory-accounting")


@router.get("/{company}")
def read(company:int,month:str,offset:int=Query(0,ge=0),db:Session=Depends(get_db),user=ActiveApplicationUser):return service.read(db,user,company,month,offset)


@router.get("/{company}/invoices/{record_id}/pdf")
def invoice_pdf(company:int,record_id:int,db:Session=Depends(get_db),user=ActiveApplicationUser):
    invoice,document=service.invoice_pdf(db,user,company,record_id)
    return Response(document.contents,media_type="application/pdf",headers={"Content-Disposition":f'attachment; filename="factura-{invoice.id}.pdf"',"Cache-Control":"private, no-store"})


@router.get("/{company}/expenses/{record_id}/receipt")
def receipt(company:int,record_id:int,db:Session=Depends(get_db),user=ActiveApplicationUser):
    document,name=service.expense_receipt(db,user,company,record_id)
    return Response(document.contents,media_type=document.content_type,headers={"Content-Disposition":f'attachment; filename="{name}"',"Cache-Control":"private, no-store","Content-Security-Policy":"sandbox","X-Content-Type-Options":"nosniff"})
