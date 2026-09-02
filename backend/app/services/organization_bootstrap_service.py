from datetime import datetime, timezone

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.company_membership import CompanyMembership
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
    PermissionDefinition,
    PermissionProfile,
    PermissionProfilePermission,
)
from app.models.user import User
from app.repositories import organization as organization_repo


ADMIN_PROFILE_NAME = "Administrador de empresa"
COMMERCIAL_PROFILE_NAME = "Comercial"
CLIENT_READER_PROFILE_NAME = "Consulta de clientes"


DEFAULT_PERMISSION_DEFINITIONS: tuple[tuple[str, str, str], ...] = (
    ("access.members.read", "access", "View company members"),
    (
        "access.members.manage",
        "access",
        "Invite, update, suspend, and reactivate company members",
    ),
    ("access.profiles.read", "access", "View permission profiles"),
    ("access.profiles.manage", "access", "Create and update permission profiles"),
    ("access.scopes.manage", "access", "Assign the scope of a permission profile"),
    ("company.settings.manage", "company", "Manage company settings"),
    ("organization.departments.read", "organization", "View departments"),
    (
        "organization.departments.manage",
        "organization",
        "Create and update departments",
    ),
    ("organization.teams.read", "organization", "View teams"),
    ("organization.teams.manage", "organization", "Create and update teams"),
    ("clients.read", "clients", "View company clients and contacts"),
    ("clients.manage", "clients", "Create, update, and email company clients"),
    (
        "commercial.follow_ups.read",
        "commercial",
        "View commercial follow-ups and their activity",
    ),
    (
        "commercial.follow_ups.manage",
        "commercial",
        "Create and update commercial follow-ups and their activity",
    ),
)

COMMERCIAL_PERMISSION_CODES = frozenset(
    {
        "clients.read",
        "clients.manage",
        "commercial.follow_ups.read",
        "commercial.follow_ups.manage",
    }
)

CLIENT_READER_PERMISSION_CODES = frozenset(
    {"clients.read", "commercial.follow_ups.read"}
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


def ensure_permission_definitions(db: Session) -> None:
    existing_codes = {
        code for (code,) in db.query(PermissionDefinition.code).all()
    }
    for code, category, description in DEFAULT_PERMISSION_DEFINITIONS:
        if code not in existing_codes:
            db.add(
                PermissionDefinition(
                    code=code,
                    category=category,
                    description=description,
                    is_active=True,
                )
            )
    db.flush()


def _ensure_system_profile(
    db: Session,
    *,
    company_id: int,
    name: str,
    description: str,
    permission_codes: set[str] | frozenset[str] | None,
) -> PermissionProfile:
    profile = (
        db.query(PermissionProfile)
        .filter(
            PermissionProfile.company_id == company_id,
            PermissionProfile.name == name,
        )
        .first()
    )
    if not profile:
        profile = PermissionProfile(
            company_id=company_id,
            name=name,
            description=description,
            is_system=True,
            is_active=True,
        )
        db.add(profile)
        db.flush()
    elif not profile.is_system:
        # A company may already own a custom profile with this display name.
        # Never convert or modify customer-managed access during bootstrap.
        return profile
    else:
        profile.description = description
        profile.is_system = True
        profile.is_active = True
        db.add(profile)

    definitions = organization_repo.list_permission_definitions(db)
    allowed_codes = (
        {definition.code for definition in definitions}
        if permission_codes is None
        else set(permission_codes)
    )
    existing_codes = {
        code
        for (code,) in (
            db.query(PermissionDefinition.code)
            .join(
                PermissionProfilePermission,
                PermissionProfilePermission.permission_definition_id
                == PermissionDefinition.id,
            )
            .filter(
                PermissionProfilePermission.permission_profile_id == profile.id,
            )
            .all()
        )
    }
    for definition in definitions:
        if definition.code in allowed_codes and definition.code not in existing_codes:
            db.add(
                PermissionProfilePermission(
                    permission_profile_id=profile.id,
                    permission_definition_id=definition.id,
                )
            )
    db.flush()
    return profile


def ensure_company_permission_profiles(db: Session, company_id: int) -> PermissionProfile:
    ensure_permission_definitions(db)
    administrator_profile = _ensure_system_profile(
        db,
        company_id=company_id,
        name=ADMIN_PROFILE_NAME,
        description="Configuración completa de la empresa",
        permission_codes=None,
    )
    if not administrator_profile.is_system:
        # A customer-managed profile must never become the implicit profile
        # assigned to company administrators just because it shares the
        # reserved display name. Stop the bootstrap rather than escalating it.
        raise RuntimeError(
            "A custom permission profile conflicts with the reserved administrator profile name"
        )
    _ensure_system_profile(
        db,
        company_id=company_id,
        name=COMMERCIAL_PROFILE_NAME,
        description="Gestiona clientes y seguimiento comercial sin acceso financiero",
        permission_codes=COMMERCIAL_PERMISSION_CODES,
    )
    _ensure_system_profile(
        db,
        company_id=company_id,
        name=CLIENT_READER_PROFILE_NAME,
        description="Consulta clientes y seguimiento comercial sin modificarlos",
        permission_codes=CLIENT_READER_PERMISSION_CODES,
    )
    return administrator_profile


def ensure_company_administrator_profile(
    db: Session, company_id: int
) -> PermissionProfile:
    return ensure_company_permission_profiles(db, company_id)


def ensure_user_membership(db: Session, user: User) -> CompanyMembership | None:
    if user.company_id is None:
        return None
    access_class = legacy_role_access_class(user)
    if access_class is None:
        return None

    administrator_profile = ensure_company_permission_profiles(db, user.company_id)

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
        if membership.status == "active":
            membership.ended_at = None
        db.add(membership)
        db.flush()

    if access_class == "admin":
        profile = administrator_profile
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
        db.execute(
            update(MembershipPermissionProfileAssignment)
            .where(
                MembershipPermissionProfileAssignment.company_id == user.company_id,
                MembershipPermissionProfileAssignment.company_membership_id
                == membership.id,
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
