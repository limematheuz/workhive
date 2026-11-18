from typing import Literal
from fastapi import APIRouter,Depends,File,UploadFile
from pydantic import BaseModel,Field
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.services import data_import_service as service
from app.services.spreadsheet_import_parser import parse

router=APIRouter(prefix="/data-import")


class ImportInput(BaseModel):
    kind:Literal["staff","clients","locations","work"]
    records:list[dict]=Field(min_length=1,max_length=500)


@router.post("/preview")
def preview(kind:Literal["staff","clients","locations","work"],file:UploadFile=File(...),db:Session=Depends(get_db),user=ActiveUser):
    contents=file.file.read(2_000_001)
    return service.preview(db,user,kind,parse(contents,file.filename or ""))


@router.post("/execute")
def execute(payload:ImportInput,db:Session=Depends(get_db),user=ActiveUser):
    return service.execute(db,user,payload.kind,payload.records)
