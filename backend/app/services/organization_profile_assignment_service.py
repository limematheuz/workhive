from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
)
from app.models.user import User
from app.repositories import organization as organization_repo
from app.schemas.organization import (
    OrganizationMemberProfileAssignmentsUpdate,
    OrganizationMemberResponse,
)
from app.services.organization_member_service import member_response
from app.services.organization_profile_scope_policy import validate_profile_scopes
from app.services.organization_bootstrap_service import ADMIN_PROFILE_NAME
from app.services.organization_service_shared import (
    CAPABILITY_MEMBERS_MANAGE,
    CAPABILITY_SCOPES_MANAGE,
    conflict,
    not_found,
    require_capability,
)


def replace_member_profile_assignments(
    db: Session,
    membership_id: int,
    payload: OrganizationMemberProfileAssignmentsUpdate,
    current_user: User,
) -> OrganizationMemberResponse:
    company_id = require_capability(db, current_user, CAPABILITY_MEMBERS_MANAGE)
    require_capability(db, current_user, CAPABILITY_SCOPES_MANAGE)
    membership = organization_repo.get_company_membership(
        db,
        company_id=company_id,
        membership_id=membership_id,
    )
    if not membership:
        not_found("Company member")
    profile_ids = [
        assignment.permission_profile_id for assignment in payload.assignments
    ]
    profiles = {
        profile.id: profile
        for profile in organization_repo.list_permission_profiles(db, company_id)
        if profile.id in profile_ids
    }
    if len(profiles) != len(profile_ids):
        not_found("Permission profile")
    if any(
        profile.is_system and profile.name == ADMIN_PROFILE_NAME
        for profile in profiles.values()
    ):
        conflict(
            "The administrator profile is assigned only through the administrator class"
        )
    if any(not profile.is_active for profile in profiles.values()):
        conflict("Inactive permission profiles cannot be assigned")

    existing_assignments = organization_repo.list_profile_assignments(
        db,
        company_id=company_id,
        membership_id=membership.id,
    )
    validate_profile_scopes(
        db,
        company_id=company_id,
        assignments=payload.assignments,
        existing_assignments=existing_assignments,
    )

    now = datetime.now(timezone.utc)
    for assignment in existing_assignments:
        # The administrator profile is tied to the administrator membership
        # class. Every other profile, including editable base profiles, must
        # follow the replacement payload so it can also be removed safely.
        if (
            assignment.permission_profile.is_system
            and assignment.permission_profile.name == ADMIN_PROFILE_NAME
        ):
            continue
        assignment.is_active = False
        assignment.revoked_at = now
        db.add(assignment)

    for input_assignment in payload.assignments:
        for scope in input_assignment.scopes:
            if not organization_repo.is_valid_scope_target(
                db,
                company_id=company_id,
                scope_type=scope.scope_type,
                scope_id=scope.scope_id,
            ):
                conflict("A permission scope must belong to the same company")
        assignment = organization_repo.get_permission_profile_assignment(
            db,
            company_id=company_id,
            membership_id=membership.id,
            profile_id=input_assignment.permission_profile_id,
        )
        if not assignment:
            assignment = MembershipPermissionProfileAssignment(
                company_id=company_id,
                company_membership_id=membership.id,
                permission_profile_id=input_assignment.permission_profile_id,
                assigned_by_user_id=current_user.id,
                is_active=True,
            )
            db.add(assignment)
            db.flush()
        else:
            assignment.is_active = True
            assignment.revoked_at = None
            assignment.assigned_by_user_id = current_user.id
            db.add(assignment)
            for existing_scope in list(assignment.scopes):
                db.delete(existing_scope)
            db.flush()
        for scope in input_assignment.scopes:
            db.add(
                MembershipPermissionProfileScope(
                    company_id=company_id,
                    profile_assignment_id=assignment.id,
                    scope_type=scope.scope_type,
                    scope_id=scope.scope_id,
                )
            )
    db.commit()
    db.refresh(membership)
    return member_response(db, company_id=company_id, membership=membership)
