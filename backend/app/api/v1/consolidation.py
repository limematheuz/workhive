from fastapi import APIRouter,Depends
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser,get_db
from app.schemas.consolidation import ConsolidationInput,CompanySettingsInput
from app.services import consolidation_service as service,company_preferences_service as preferences

router=APIRouter(prefix="/consolidation")


@router.get("/companies")
def companies(db:Session=Depends(get_db),user=ActiveUser):
    return service.companies(db,user)


@router.post("/report")
def report(payload:ConsolidationInput,db:Session=Depends(get_db),user=ActiveUser):
    return service.report(db,user,payload)


@router.get("/settings")
def settings(db:Session=Depends(get_db),user=ActiveUser):
    return preferences.read(db,user)


@router.put("/settings")
def save_settings(payload:CompanySettingsInput,db:Session=Depends(get_db),user=ActiveUser):
    return preferences.save(db,user,payload)
