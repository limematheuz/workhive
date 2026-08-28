from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveApplicationUser, get_db
from app.models.user import User
from app.schemas.organization import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    OrganizationMemberProfileAssignmentsUpdate,
    OrganizationMemberResponse,
    OrganizationMemberUpdate,
    PermissionDefinitionResponse,
    PermissionProfileCreate,
    PermissionProfileResponse,
    PermissionProfileUpdate,
    TeamCreate,
    TeamResponse,
    TeamUpdate,
)
from app.services import audit_service, organization_service


router = APIRouter()


@router.get("/members", response_model=list[OrganizationMemberResponse])
def read_members(
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    return organization_service.list_members(db, current_user)


@router.patch("/members/{membership_id}", response_model=OrganizationMemberResponse)
def update_member(
    membership_id: int,
    payload: OrganizationMemberUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    member = organization_service.update_member(db, membership_id, payload, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.member_updated",
        entity_type="company_membership",
        entity_id=member.id,
        request=request,
    )
    return member


@router.put("/members/{membership_id}/profile-assignments", response_model=OrganizationMemberResponse)
def replace_member_profile_assignments(
    membership_id: int,
    payload: OrganizationMemberProfileAssignmentsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    member = organization_service.replace_member_profile_assignments(
        db,
        membership_id,
        payload,
        current_user,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.member_profiles_replaced",
        entity_type="company_membership",
        entity_id=member.id,
        request=request,
    )
    return member


@router.get("/departments", response_model=list[DepartmentResponse])
def read_departments(
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    return organization_service.list_departments(db, current_user)


@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    department = organization_service.create_department(db, payload, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.department_created",
        entity_type="department",
        entity_id=department.id,
        request=request,
    )
    return department


@router.patch("/departments/{department_id}", response_model=DepartmentResponse)
def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    department = organization_service.update_department(
        db,
        department_id,
        payload,
        current_user,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.department_updated",
        entity_type="department",
        entity_id=department.id,
        request=request,
    )
    return department


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


@router.get("/permission-definitions", response_model=list[PermissionDefinitionResponse])
def read_permission_definitions(
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    return organization_service.list_permission_definitions(db, current_user)


@router.get("/permission-profiles", response_model=list[PermissionProfileResponse])
def read_permission_profiles(
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    return organization_service.list_permission_profiles(db, current_user)


@router.post("/permission-profiles", response_model=PermissionProfileResponse, status_code=status.HTTP_201_CREATED)
def create_permission_profile(
    payload: PermissionProfileCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    profile = organization_service.create_permission_profile(db, payload, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.permission_profile_created",
        entity_type="permission_profile",
        entity_id=profile.id,
        request=request,
    )
    return profile


@router.patch("/permission-profiles/{profile_id}", response_model=PermissionProfileResponse)
def update_permission_profile(
    profile_id: int,
    payload: PermissionProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    profile = organization_service.update_permission_profile(
        db,
        profile_id,
        payload,
        current_user,
    )
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.permission_profile_updated",
        entity_type="permission_profile",
        entity_id=profile.id,
        request=request,
    )
    return profile
