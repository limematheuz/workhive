from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.deps import get_authenticated_identity, get_db
from app.models.user import User
from app.services import platform_team

router = APIRouter()


class InvitationInput(BaseModel):
    email: EmailStr


@router.get("")
def roster(actor: User = Depends(get_authenticated_identity), db: Session = Depends(get_db)):
    return platform_team.list_team(db, actor)


@router.post("", status_code=201)
def invite(payload: InvitationInput, response: Response, actor: User = Depends(get_authenticated_identity), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return platform_team.invite(db, actor, str(payload.email).lower())


@router.post("/{identifier}/resend")
def resend(identifier: int, response: Response, actor: User = Depends(get_authenticated_identity), db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return platform_team.resend(db, actor, identifier)


@router.delete("/{identifier}", status_code=204)
def revoke(identifier: int, actor: User = Depends(get_authenticated_identity), db: Session = Depends(get_db)):
    platform_team.revoke(db, actor, identifier)
