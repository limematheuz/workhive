from datetime import datetime, timezone

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.company_membership import CompanyMembership
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
)
from app.models.user import User
from app.repositories import organization as organization_repo
from app.services.organization_base_profile_service import (
    ADMIN_PROFILE_NAME,
    ensure_company_permission_profiles,
)


def legacy_role_name_access_class(role_name: str | None) -> str | None:
    return {
        "admin": "admin",
        "manager": "responsible",
        "viewer": "worker",
        "accountant": "responsible",
    }.get(role_name)


def legacy_role_access_class(user: User) -> str | None:
    return legacy_role_name_access_class(user.role.name if user.role else None)


def ensure_legacy_membership(
    db: Session,
    user: User,
    *,
    existing_membership: CompanyMembership | None = None,
) -> CompanyMembership | None:
    """Create the minimal membership record needed by the legacy transition.

    Authorization reads must not bootstrap profiles or rewrite profile grants.
    Full profile setup remains an explicit company/member lifecycle operation in
    :func:`ensure_user_membership` and the database migration backfills
    existing companies.
    """

    if user.company_id is None:
        return None
    access_class = legacy_role_access_class(user)
    if access_class is None:
        return None

    membership = existing_membership or organization_repo.get_user_membership(
        db,
        company_id=user.company_id,
        user_id=user.id,
    )
    if not membership:
        membership = CompanyMembership(
            user_id=user.id,
            company_id=user.company_id,
            access_class=access_class,
            status="active" if user.is_active else "suspended",
        )
        db.add(membership)
        db.flush()
    else:
        membership.access_class = access_class
        membership.status = "active" if user.is_active else "suspended"
        if membership.status == "active":
            membership.ended_at = None
        db.add(membership)
        db.flush()
    return membership


def ensure_user_membership(db: Session, user: User) -> CompanyMembership | None:
    membership = ensure_legacy_membership(db, user)
    if membership is None or user.company_id is None:
        return membership

    ensure_company_permission_profiles(db, user.company_id)

    system_profile_name = (
        ADMIN_PROFILE_NAME if user.role and user.role.name == "admin" else None
    )
    system_profiles = {
        profile.name: profile
        for profile in organization_repo.list_permission_profiles(db, user.company_id)
        if profile.is_system
    }
    if system_profile_name:
        profile = system_profiles[system_profile_name]
        assignment = organization_repo.get_permission_profile_assignment(
            db,
            company_id=user.company_id,
            membership_id=membership.id,
            profile_id=profile.id,
        )
        if not assignment:
            assignment = MembershipPermissionProfileAssignment(
                company_id=user.company_id,
                company_membership_id=membership.id,
                permission_profile_id=profile.id,
                assigned_by_user_id=user.id,
                is_active=True,
            )
            db.add(assignment)
            db.flush()
        else:
            assignment.is_active = True
            assignment.revoked_at = None
            db.add(assignment)
            db.flush()

        existing_scope = (
            db.query(MembershipPermissionProfileScope)
            .filter(
                MembershipPermissionProfileScope.company_id == user.company_id,
                MembershipPermissionProfileScope.profile_assignment_id == assignment.id,
                MembershipPermissionProfileScope.scope_type == "company",
                MembershipPermissionProfileScope.scope_id == user.company_id,
            )
            .first()
        )
        if not existing_scope:
            db.add(
                MembershipPermissionProfileScope(
                    company_id=user.company_id,
                    profile_assignment_id=assignment.id,
                    scope_type="company",
                    scope_id=user.company_id,
                )
            )
            db.flush()
    # The administrator profile mirrors the legacy ``admin`` role. The other
    # base profiles are deliberately assignable through the profile workflow,
    # so syncing a membership must never silently revoke them.
    administrator_profile = system_profiles.get(ADMIN_PROFILE_NAME)
    if not system_profile_name and administrator_profile:
        db.execute(
            update(MembershipPermissionProfileAssignment)
            .where(
                MembershipPermissionProfileAssignment.company_id == user.company_id,
                MembershipPermissionProfileAssignment.company_membership_id == membership.id,
                MembershipPermissionProfileAssignment.permission_profile_id
                == administrator_profile.id,
            )
            .values(is_active=False, revoked_at=datetime.now(timezone.utc))
        )
    db.flush()
    return membership
