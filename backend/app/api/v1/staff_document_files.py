from fastapi import APIRouter,Depends,File,UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,ActiveApplicationUser,get_db
from app.services import staff_document_file_service as service

router=APIRouter(prefix="/staff-files")


@router.post("/{employee_id}",status_code=201)
def upload(employee_id:int,file:UploadFile=File(...),db:Session=Depends(get_db),user=ActiveUser):
    return service.upload(db,user,employee_id,file.filename,file.content_type,file.file.read(20_000_001))


@router.get("/{file_id}/download")
def download(file_id:int,db:Session=Depends(get_db),user=ActiveApplicationUser):
    row,content=service.download(db,user,file_id)
    return Response(content,media_type=row.content_type,headers={"Content-Disposition":f'attachment; filename="{row.name}"',"Cache-Control":"private, no-store"})
