from datetime import datetime, timezone

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.company_membership import CompanyMembership
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
    PermissionProfile,
    PermissionProfilePermission,
)
from app.models.user import User
from app.repositories import organization as organization_repo


ADMIN_PROFILE_NAME = "Administrador de empresa"


def legacy_role_access_class(user: User) -> str | None:
    role_name = user.role.name if user.role else None
    return {
        "admin": "admin",
        "manager": "responsible",
        "viewer": "worker",
        "accountant": "responsible",
    }.get(role_name)


def ensure_company_administrator_profile(db: Session, company_id: int) -> PermissionProfile:
    profile = organization_repo.get_system_administrator_profile(db, company_id)
    if profile:
        return profile

    definitions = organization_repo.list_permission_definitions(db)
    profile = PermissionProfile(
        company_id=company_id,
        name=ADMIN_PROFILE_NAME,
        description="Configuración completa de la empresa",
        is_system=True,
        is_active=True,
    )
    db.add(profile)
    db.flush()
    for definition in definitions:
        db.add(
            PermissionProfilePermission(
                permission_profile_id=profile.id,
                permission_definition_id=definition.id,
            )
        )
    db.flush()
    return profile


def ensure_user_membership(db: Session, user: User) -> CompanyMembership | None:
    if user.company_id is None:
        return None
    access_class = legacy_role_access_class(user)
    if access_class is None:
        return None

    membership = organization_repo.get_user_membership(
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
        db.add(membership)
        db.flush()

    if access_class == "admin":
        profile = ensure_company_administrator_profile(db, user.company_id)
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
    else:
        administrator_profile = organization_repo.get_system_administrator_profile(
            db,
            user.company_id,
        )
        if administrator_profile:
            db.execute(
                update(MembershipPermissionProfileAssignment)
                .where(
                    MembershipPermissionProfileAssignment.company_id == user.company_id,
                    MembershipPermissionProfileAssignment.company_membership_id == membership.id,
                    MembershipPermissionProfileAssignment.permission_profile_id
                    == administrator_profile.id,
                )
                .values(
                    is_active=False,
                    revoked_at=datetime.now(timezone.utc),
                )
            )
            db.flush()
    return membership
