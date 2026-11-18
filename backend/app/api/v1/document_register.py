from datetime import date
from typing import Literal
from fastapi import APIRouter,Depends,Form,File,UploadFile,Query,Response
from sqlalchemy.orm import Session
from app.api.deps import ActiveApplicationUser,ActiveClientPortal,ClientPortalPrincipal,get_db
from app.schemas.document_register import LinkDocument,SignDocument,PublishDocument
from app.services import document_register_service as service,document_signature_service as signatures

router=APIRouter()


def file_response(revision,contents):
    return Response(contents,media_type=revision.content_type,headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox","Content-Disposition":f'inline; filename="document-{revision.document_id}-r{revision.revision}"'})


@router.get("/document-register")
def read(owner_type:Literal["client","location","staff"]|None=None,owner_id:int|None=Query(None,ge=1),search:str=Query("",max_length=200),company_id:int|None=Query(None,ge=1),offset:int=Query(0,ge=0),db:Session=Depends(get_db),user=ActiveApplicationUser):
    return service.read(db,user,owner_type,owner_id,search,company_id,offset)


@router.post("/document-register/link")
def link(payload:LinkDocument,db:Session=Depends(get_db),user=ActiveApplicationUser):return service.link(db,user,payload)


@router.post("/document-register",status_code=201)
def create(owner_type:Literal["client","location","staff"]=Form(...),owner_id:int=Form(...,ge=1),title:str=Form(...,min_length=2,max_length=255),document_type:str=Form("other",max_length=40),expires_on:date|None=Form(None),file:UploadFile=File(...),db:Session=Depends(get_db),user=ActiveApplicationUser):
    return service.upload(db,user,owner_type,owner_id,title.strip(),document_type,expires_on,file.filename,file.content_type,file.file.read(10*1024*1024+1))


@router.post("/document-register/{id}/revisions",status_code=201)
def revision(id:int,expected_revision:int=Form(...,ge=1),title:str=Form("",max_length=255),expires_on:date|None=Form(None),file:UploadFile=File(...),db:Session=Depends(get_db),user=ActiveApplicationUser):
    return service.upload(db,user,None,None,title.strip(),None,expires_on,file.filename,file.content_type,file.file.read(10*1024*1024+1),id,expected_revision)


@router.get("/document-register/{id}/revisions")
def versions(id:int,db:Session=Depends(get_db),user=ActiveApplicationUser):return service.versions(db,user,id)


@router.get("/document-register/{id}/revisions/{revision_id}/download")
def download(id:int,revision_id:int,db:Session=Depends(get_db),user=ActiveApplicationUser):return file_response(*service.download(db,user,id,revision_id))


@router.post("/document-register/{id}/revisions/{revision_id}/sign")
def sign(id:int,revision_id:int,payload:SignDocument,db:Session=Depends(get_db),user=ActiveApplicationUser):return signatures.sign(db,user,id,revision_id,payload)


@router.post("/document-register/{id}/publication")
def publish(id:int,payload:PublishDocument,db:Session=Depends(get_db),user=ActiveApplicationUser):return signatures.publish(db,user,id,payload)


@router.get("/client-portal/workspaces/{grant_id}/documents")
def portal_list(offset:int=Query(0,ge=0),db:Session=Depends(get_db),principal:ClientPortalPrincipal=ActiveClientPortal):return signatures.portal_list(db,principal,offset)


@router.get("/client-portal/workspaces/{grant_id}/documents/{id}/revisions/{revision_id}/download")
def portal_download(id:int,revision_id:int,db:Session=Depends(get_db),principal:ClientPortalPrincipal=ActiveClientPortal):return file_response(*signatures.portal_download(db,principal,id,revision_id))


@router.post("/client-portal/workspaces/{grant_id}/documents/{id}/revisions/{revision_id}/sign")
def portal_sign(id:int,revision_id:int,payload:SignDocument,db:Session=Depends(get_db),principal:ClientPortalPrincipal=ActiveClientPortal):return signatures.portal_sign(db,principal,id,revision_id,payload)
