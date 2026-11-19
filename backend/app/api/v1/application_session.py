"""Authenticated selector; all choices are derived from owned relationships."""
import secrets
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from app.api.deps import AuthenticatedIdentity, get_db, get_session_claims
from app.api.session_cookies import set_session_cookies
from app.schemas.application_session import ApplicationOptions, ApplicationSwitch, ApplicationSwitched
from app.services import application_session_service as service

router = APIRouter(prefix="/session/applications")


@router.get("", response_model=ApplicationOptions)
def choices(db: Session = Depends(get_db), user=AuthenticatedIdentity, claims=Depends(get_session_claims)):
    return service.options(db, user, claims)


@router.post("/switch", response_model=ApplicationSwitched)
def change(payload: ApplicationSwitch, response: Response, db: Session = Depends(get_db), user=AuthenticatedIdentity):
    result = service.switch(db, user, payload.key)
    csrf = secrets.token_urlsafe(32)
    set_session_cookies(response, result["access_token"], csrf)
    return {**result, "csrf_token": csrf}
