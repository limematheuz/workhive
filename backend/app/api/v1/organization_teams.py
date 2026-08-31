from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveApplicationUser, get_db
from app.models.user import User
from app.schemas.organization import (
    TeamCreate,
    TeamMembersUpdate,
    TeamResponse,
    TeamUpdate,
)
from app.services import audit_service, organization_service


router = APIRouter()


@router.get("/teams", response_model=list[TeamResponse])
def read_teams(
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    return organization_service.list_teams(db, current_user)


@router.post("/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    team = organization_service.create_team(db, payload, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.team_created",
        entity_type="team",
        entity_id=team.id,
        request=request,
    )
    return team


@router.patch("/teams/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: int,
    payload: TeamUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    team = organization_service.update_team(db, team_id, payload, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.team_updated",
        entity_type="team",
        entity_id=team.id,
        request=request,
    )
    return team


@router.put("/teams/{team_id}/members", response_model=TeamResponse)
def replace_team_members(
    team_id: int,
    payload: TeamMembersUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    team = organization_service.replace_team_members_for_team(
        db,
        team_id,
        payload,
        current_user,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.team_members_replaced",
        entity_type="team",
        entity_id=team.id,
        request=request,
    )
    return team


@router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    organization_service.delete_team(db, team_id, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.team_deleted",
        entity_type="team",
        entity_id=team_id,
        request=request,
    )
