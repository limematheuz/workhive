from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company_membership import (
    CompanyMembership,
    DepartmentMembership,
    TeamMembership,
)
from app.models.user import User
from app.repositories import organization as organization_repo
from app.repositories import role as role_repo
from app.schemas.organization import (
    OrganizationMemberProfileAssignmentResponse,
    OrganizationMemberProfileScopeResponse,
    OrganizationMemberResponse,
    OrganizationMemberUpdate,
)
from app.services import organization_bootstrap_service
from app.services.organization_service_shared import (
    CAPABILITY_MEMBERS_MANAGE,
    CAPABILITY_MEMBERS_READ,
    conflict,
    not_found,
    require_capability,
)


def member_response(
    db: Session,
    *,
    company_id: int,
    membership: CompanyMembership,
) -> OrganizationMemberResponse:
    user = membership.user
    assignments = organization_repo.list_profile_assignments(
        db,
        company_id=company_id,
        membership_id=membership.id,
    )
    return OrganizationMemberResponse(
        id=membership.id,
        user_id=membership.user_id,
        full_name=user.full_name if user else None,
        email=user.email if user else "",
        access_class=membership.access_class,
        status=membership.status,
        legacy_role_name=user.role.name if user and user.role else None,
        department_ids=sorted(
            assignment.department_id
            for assignment in organization_repo.list_department_memberships(
                db,
                company_id=company_id,
                membership_id=membership.id,
            )
        ),
        team_ids=sorted(
            assignment.team_id
            for assignment in organization_repo.list_team_memberships(
                db,
                company_id=company_id,
                membership_id=membership.id,
            )
        ),
        profile_assignments=[
            OrganizationMemberProfileAssignmentResponse(
                id=assignment.id,
                permission_profile_id=assignment.permission_profile_id,
                permission_profile_name=assignment.permission_profile.name,
                scopes=[
                    OrganizationMemberProfileScopeResponse(
                        id=scope.id,
                        scope_type=scope.scope_type,
                        scope_id=scope.scope_id,
                    )
                    for scope in sorted(
                        assignment.scopes,
                        key=lambda scope: (scope.scope_type, scope.scope_id, scope.id),
                    )
                ],
            )
            for assignment in assignments
        ],
    )


def list_members(db: Session, current_user: User) -> list[OrganizationMemberResponse]:
    company_id = require_capability(db, current_user, CAPABILITY_MEMBERS_READ)
    return [
        member_response(db, company_id=company_id, membership=membership)
        for membership in organization_repo.list_company_memberships(db, company_id)
    ]


def active_admin_count(db: Session, company_id: int) -> int:
    return (
        db.query(CompanyMembership)
        .filter(
            CompanyMembership.company_id == company_id,
            CompanyMembership.status == "active",
            CompanyMembership.access_class == "admin",
        )
        .count()
    )


def replace_department_memberships(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
    department_ids: list[int],
) -> None:
    departments = {
        department.id: department
        for department in organization_repo.list_departments(db, company_id)
        if department.id in department_ids
    }
    if len(departments) != len(department_ids):
        not_found("Department")
    existing = {
        assignment.department_id: assignment
        for assignment in organization_repo.list_department_memberships(
            db,
            company_id=company_id,
            membership_id=membership_id,
        )
    }
    for department_id, assignment in existing.items():
        if department_id not in department_ids:
            assignment.is_active = False
            assignment.is_primary = False
            db.add(assignment)
    for position, department_id in enumerate(department_ids):
        assignment = existing.get(department_id)
        if assignment:
            assignment.is_active = True
            assignment.is_primary = position == 0
            db.add(assignment)
        else:
            db.add(
                DepartmentMembership(
                    company_id=company_id,
                    department_id=department_id,
                    company_membership_id=membership_id,
                    is_primary=position == 0,
                    is_active=True,
                )
            )


def replace_team_memberships(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
    team_ids: list[int],
) -> None:
    teams = {
        team.id: team
        for team in organization_repo.list_teams(db, company_id)
        if team.id in team_ids
    }
    if len(teams) != len(team_ids):
        not_found("Team")
    existing = {
        assignment.team_id: assignment
        for assignment in organization_repo.list_team_memberships(
            db,
            company_id=company_id,
            membership_id=membership_id,
        )
    }
    for team_id, assignment in existing.items():
        if team_id not in team_ids:
            assignment.is_active = False
            db.add(assignment)
    for team_id in team_ids:
        assignment = existing.get(team_id)
        if assignment:
            assignment.is_active = True
            db.add(assignment)
        else:
            db.add(
                TeamMembership(
                    company_id=company_id,
                    team_id=team_id,
                    company_membership_id=membership_id,
                    is_active=True,
                )
            )


def update_member(
    db: Session,
    membership_id: int,
    payload: OrganizationMemberUpdate,
    current_user: User,
) -> OrganizationMemberResponse:
    company_id = require_capability(db, current_user, CAPABILITY_MEMBERS_MANAGE)
    membership = organization_repo.get_company_membership(
        db,
        company_id=company_id,
        membership_id=membership_id,
    )
    if not membership or not membership.user:
        not_found("Company member")
    next_access_class = payload.access_class or membership.access_class
    next_status = payload.status or membership.status
    if membership.user_id == current_user.id and (
        next_access_class != "admin" or next_status != "active"
    ):
        conflict("You cannot remove or suspend your own company administration access")
    if membership.user.role and membership.user.role.name == "accountant" and payload.access_class:
        conflict("The accountant role will move through the dedicated external portal migration")
    if (
        membership.access_class == "admin"
        and membership.status == "active"
        and (next_access_class != "admin" or next_status != "active")
        and active_admin_count(db, company_id) == 1
    ):
        conflict("A company must keep at least one active administrator")

    membership.access_class = next_access_class
    membership.status = next_status
    membership.user.is_active = next_status == "active"
    db.add_all([membership, membership.user])
    if payload.access_class and membership.user.role and membership.user.role.name != "accountant":
        role_name = {"admin": "admin", "responsible": "manager", "worker": "viewer"}[payload.access_class]
        legacy_role = role_repo.get_role_by_name(db, role_name)
        if not legacy_role:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Legacy role '{role_name}' not configured",
            )
        membership.user.role_id = legacy_role.id
        membership.user.role = legacy_role
        db.add(membership.user)
    if payload.department_ids is not None:
        replace_department_memberships(
            db, company_id=company_id, membership_id=membership.id, department_ids=payload.department_ids
        )
    if payload.team_ids is not None:
        replace_team_memberships(
            db, company_id=company_id, membership_id=membership.id, team_ids=payload.team_ids
        )
    organization_bootstrap_service.ensure_user_membership(db, membership.user)
    db.commit()
    db.refresh(membership)
    return member_response(db, company_id=company_id, membership=membership)
