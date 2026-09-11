from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company_membership import (
    CompanyMembership,
    DepartmentMembership,
    TeamMembership,
)
from app.models.permission_profile import MembershipPermissionProfileAssignment
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
from app.services.entitlement_service import require_internal_member_capacity
from app.services.organization_department_membership_service import (
    replace_department_memberships as replace_department_memberships_for_member,
)
from app.services.organization_team_membership_service import (
    replace_team_memberships as replace_team_memberships_for_member,
)
from app.services.organization_service_shared import (
    CAPABILITY_MEMBERS_MANAGE,
    CAPABILITY_MEMBERS_READ,
    conflict,
    not_found,
    require_capability,
)


def is_anonymized_member(user: User | None) -> bool:
    if not user:
        return True
    return (
        not user.is_active
        and user.email.startswith("deleted+")
        and user.email.endswith("@invalid.workhive.local")
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
        ended_at=membership.ended_at,
        is_anonymized=is_anonymized_member(user),
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


def update_member(
    db: Session,
    membership_id: int,
    payload: OrganizationMemberUpdate,
    current_user: User,
    *,
    commit: bool = True,
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
    if next_status == "archived":
        conflict("Use the company removal action to retire a person from this company")
    if membership.user_id == current_user.id and (
        next_access_class != "admin" or next_status != "active"
    ):
        conflict("You cannot remove or suspend your own company administration access")
    if (
        membership.access_class == "admin"
        and membership.status == "active"
        and (next_access_class != "admin" or next_status != "active")
        and active_admin_count(db, company_id) == 1
    ):
        conflict("A company must keep at least one active administrator")
    if next_status == "active" and (
        membership.status != "active" or next_access_class != membership.access_class
    ):
        require_internal_member_capacity(
            db,
            company_id=company_id,
            access_class=next_access_class,
            exclude_membership_id=membership.id,
        )

    security_changed = next_status != membership.status or next_access_class != membership.access_class
    previous_status = membership.status
    membership.access_class = next_access_class
    membership.status = next_status
    if next_status == "archived" and previous_status != "archived":
        membership.ended_at = datetime.now(timezone.utc)
    elif next_status == "active":
        membership.ended_at = None
    membership.user.is_active = next_status == "active"
    if security_changed:
        membership.user.session_version += 1
    db.add_all([membership, membership.user])
    if (
        payload.access_class
        and membership.user.role
        and membership.user.role.name != "external_portal"
    ):
        role_name = {"admin": "admin", "responsible": "manager", "worker": "viewer"}[
            payload.access_class
        ]
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
        replace_department_memberships_for_member(
            db,
            company_id=company_id,
            membership_id=membership.id,
            department_ids=payload.department_ids,
        )
    if payload.team_ids is not None:
        replace_team_memberships_for_member(
            db,
            company_id=company_id,
            membership_id=membership.id,
            team_ids=payload.team_ids,
        )
    organization_bootstrap_service.ensure_user_membership(db, membership.user)
    if commit:
        db.commit()
    else:
        db.flush()
    db.refresh(membership)
    return member_response(db, company_id=company_id, membership=membership)


def remove_member(
    db: Session,
    membership_id: int,
    current_user: User,
) -> None:
    """Retire a person from one company without deleting their WorkHive identity.

    A company administrator manages a membership, never another person's global
    account.  The historical membership remains as evidence of the prior
    relationship, while all active company-scoped access is revoked.
    """

    company_id = require_capability(db, current_user, CAPABILITY_MEMBERS_MANAGE)
    membership = organization_repo.get_company_membership(
        db,
        company_id=company_id,
        membership_id=membership_id,
    )
    if not membership or not membership.user:
        not_found("Company member")
    if membership.user_id == current_user.id:
        conflict("You cannot remove yourself from the company")
    if membership.status == "archived":
        conflict("This person has already been removed from the company")
    if (
        membership.access_class == "admin"
        and membership.status == "active"
        and active_admin_count(db, company_id) == 1
    ):
        conflict("A company must keep at least one active administrator")

    now = datetime.now(timezone.utc)
    (
        db.query(DepartmentMembership)
        .filter(
            DepartmentMembership.company_id == company_id,
            DepartmentMembership.company_membership_id == membership.id,
            DepartmentMembership.is_active.is_(True),
        )
        .update(
            {
                DepartmentMembership.is_active: False,
                DepartmentMembership.is_primary: False,
                DepartmentMembership.is_lead: False,
            },
            synchronize_session=False,
        )
    )
    (
        db.query(TeamMembership)
        .filter(
            TeamMembership.company_id == company_id,
            TeamMembership.company_membership_id == membership.id,
            TeamMembership.is_active.is_(True),
        )
        .update({TeamMembership.is_active: False}, synchronize_session=False)
    )
    (
        db.query(MembershipPermissionProfileAssignment)
        .filter(
            MembershipPermissionProfileAssignment.company_id == company_id,
            MembershipPermissionProfileAssignment.company_membership_id
            == membership.id,
            MembershipPermissionProfileAssignment.is_active.is_(True),
        )
        .update(
            {
                MembershipPermissionProfileAssignment.is_active: False,
                MembershipPermissionProfileAssignment.revoked_at: now,
            },
            synchronize_session=False,
        )
    )

    viewer_role = role_repo.get_role_by_name(db, "viewer")
    if not viewer_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Legacy role 'viewer' not configured",
        )

    membership.status = "archived"
    membership.ended_at = now
    membership.user.company_id = None
    membership.user.role_id = viewer_role.id
    membership.user.role = viewer_role
    # The person still owns a WorkHive identity and can sign in to manage their
    # privacy requests or accept a new invitation.  Existing sessions are
    # invalidated so the revoked company access cannot remain in a browser.
    membership.user.is_active = True
    membership.user.session_version += 1
    db.add_all([membership, membership.user])
    db.commit()
