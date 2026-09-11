from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveApplicationUser, get_db
from app.models.user import User
from app.schemas.organization import (
    OrganizationMemberProfileAssignmentsUpdate,
    OrganizationMemberResponse,
    OrganizationMemberAccessUpdate,
    PermissionDefinitionResponse,
    PermissionProfileCreate,
    PermissionProfileResponse,
    PermissionProfileUpdate,
)
from app.services import audit_service, organization_service
from app.services.organization_access_summary_service import access_summary


router = APIRouter()


@router.get("/access", response_model=dict[str, bool])
def read_organization_access(db: Session = Depends(get_db), current_user: User = ActiveApplicationUser):
    return access_summary(db, current_user)


@router.get("/members", response_model=list[OrganizationMemberResponse])
def read_members(
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    return organization_service.list_members(db, current_user)


@router.patch("/members/{membership_id}", response_model=OrganizationMemberResponse)
def update_member(
    membership_id: int,
    payload: OrganizationMemberAccessUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    member = organization_service.update_member(
        db, membership_id, payload, current_user
    )
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


@router.delete("/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    membership_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    organization_service.remove_member(db, membership_id, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.member_removed",
        entity_type="company_membership",
        entity_id=membership_id,
        request=request,
    )


@router.put(
    "/members/{membership_id}/profile-assignments",
    response_model=OrganizationMemberResponse,
)
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


@router.get(
    "/permission-definitions", response_model=list[PermissionDefinitionResponse]
)
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


@router.post(
    "/permission-profiles",
    response_model=PermissionProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
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


@router.patch(
    "/permission-profiles/{profile_id}", response_model=PermissionProfileResponse
)
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


@router.delete(
    "/permission-profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_permission_profile(
    profile_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = ActiveApplicationUser,
):
    organization_service.delete_permission_profile(db, profile_id, current_user)
    audit_service.record_event(
        db,
        actor=current_user,
        company_id=current_user.company_id,
        action="organization.permission_profile_deleted",
        entity_type="permission_profile",
        entity_id=profile_id,
        request=request,
    )
