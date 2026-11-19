"""Maintain company-local access without modifying a person's identity."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.company_membership import CompanyMembership
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
)
from app.repositories import organization as organization_repo
from app.services.organization_base_profile_service import (
    ADMIN_PROFILE_NAME,
    ensure_company_permission_profiles,
)


def sync_administrator_profile(
    db: Session, membership: CompanyMembership, *, actor_id: int | None
) -> None:
    """Administrator rights follow this membership, never the global User role."""
    ensure_company_permission_profiles(db, membership.company_id)
    profile = next(
        (profile for profile in organization_repo.list_permission_profiles(db, membership.company_id)
         if profile.is_system and profile.name == ADMIN_PROFILE_NAME),
        None,
    )
    if profile is None:
        raise RuntimeError("The company administrator permission profile is missing")
    assignment = organization_repo.get_permission_profile_assignment(
        db, company_id=membership.company_id, membership_id=membership.id, profile_id=profile.id
    )
    authorized = membership.access_class == "admin" and membership.status == "active"
    if not authorized:
        if assignment and assignment.is_active:
            assignment.is_active = False
            assignment.revoked_at = datetime.now(timezone.utc)
        return
    if assignment is None:
        assignment = MembershipPermissionProfileAssignment(
            company_id=membership.company_id, company_membership_id=membership.id,
            permission_profile_id=profile.id, assigned_by_user_id=actor_id, is_active=True,
        )
        db.add(assignment)
        db.flush()
    else:
        assignment.is_active = True
        assignment.revoked_at = None
        assignment.assigned_by_user_id = actor_id
    if not any(scope.scope_type == "company" and scope.scope_id == membership.company_id
               for scope in assignment.scopes):
        db.add(MembershipPermissionProfileScope(
            company_id=membership.company_id, profile_assignment_id=assignment.id,
            scope_type="company", scope_id=membership.company_id,
        ))
    db.flush()
