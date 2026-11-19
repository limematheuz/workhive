import secrets
from fastapi import APIRouter,Depends,Response
from pydantic import BaseModel,Field
from sqlalchemy.orm import Session
from app.api.deps import AuthenticatedUser,get_db
from app.api.session_cookies import set_session_cookies
from app.services import company_session_service as service

router=APIRouter(prefix="/session")


class CompanyChoice(BaseModel):
    company_id:int=Field(ge=1)


@router.get("/companies")
def choices(db:Session=Depends(get_db),user=AuthenticatedUser):return service.options(db,user)


@router.post("/company")
def change(payload:CompanyChoice,response:Response,db:Session=Depends(get_db),user=AuthenticatedUser):
    result=service.switch(db,user,payload.company_id)
    csrf=secrets.token_urlsafe(32);set_session_cookies(response,result["access_token"],csrf)
    return {**result,"csrf_token":csrf}
