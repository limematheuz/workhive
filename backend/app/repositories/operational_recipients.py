"""Batch candidate selection using the canonical membership/profile graph."""

from sqlalchemy import and_, exists, or_, select
from sqlalchemy.orm import Session

from app.models.company_membership import CompanyMembership, Department, Team
from app.models.location import Location
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment as Assignment,
    MembershipPermissionProfileScope as Scope,
    PermissionDefinition,
    PermissionProfile,
    PermissionProfilePermission,
)
from app.models.role import Role
from app.models.user import User


def select_ids(db: Session, query, ids: set[int]) -> set[int]:
    return set(db.scalars(query.where(User.id.in_(ids)))) if ids else set()


def select_users(db: Session, query) -> list[User]:
    return list(db.scalars(select(User).where(User.id.in_(query)).order_by(User.id)))


def legacy_access_condition(company_id: int, role_names: tuple[str, ...]):
    history = exists().where(
        Assignment.company_membership_id == CompanyMembership.id,
        Assignment.company_id == company_id,
    )
    return and_(
        Role.name.in_(role_names),
        or_(
            CompanyMembership.id.is_(None),
            and_(
                CompanyMembership.permissions_configured.is_(False),
                ~history,
            ),
        ),
    )


def legacy_viewer_ids(company_id: int):
    return (
        select(User.id)
        .join(Role, Role.id == User.role_id)
        .outerjoin(
            CompanyMembership,
            and_(
                CompanyMembership.user_id == User.id,
                CompanyMembership.company_id == company_id,
            ),
        )
        .where(
            User.company_id == company_id,
            legacy_access_condition(company_id, ("viewer",)),
        )
    )


def eligible_user_ids(
    *,
    company_id: int,
    capabilities: tuple[str, ...],
    legacy_roles: tuple[str, ...],
    location_id: int | None = None,
    company_scope_only: bool = False,
):
    """Return a selectable, applied before directory pagination or notification fanout.

    A revoked profile still disables the legacy bridge. Department/team work
    scopes follow the resolver's owned-location rule; direct location scopes
    remain exact. This selects candidates, never authorizes a caller's action.
    """
    legacy = legacy_access_condition(company_id, legacy_roles)
    scope_matches = [and_(Scope.scope_type == "company", Scope.scope_id == company_id)]
    if not company_scope_only and location_id is None:
        scope_matches.extend(
            [
                and_(
                    Scope.scope_type == "location",
                    exists().where(
                        Location.id == Scope.scope_id,
                        or_(
                            Location.owner_company_id == company_id,
                            Location.managing_company_id == company_id,
                        ),
                    ),
                ),
                and_(
                    Scope.scope_type == "department",
                    exists().where(
                        Department.id == Scope.scope_id,
                        Department.company_id == company_id,
                        Department.is_active.is_(True),
                    ),
                ),
                and_(
                    Scope.scope_type == "team",
                    exists().where(
                        Team.id == Scope.scope_id,
                        Team.company_id == company_id,
                        Team.is_active.is_(True),
                    ),
                ),
            ]
        )
    elif not company_scope_only:
        scope_matches.extend(
            [
                and_(Scope.scope_type == "location", Scope.scope_id == location_id),
                and_(
                    Scope.scope_type.in_(("department", "team")),
                    exists()
                    .where(
                        Location.id == location_id,
                        Location.owner_company_id == company_id,
                        Location.is_active.is_(True),
                        or_(
                            and_(
                                Scope.scope_type == "department",
                                Scope.scope_id == Location.department_id,
                            ),
                            and_(
                                Scope.scope_type == "team",
                                Scope.scope_id == Location.team_id,
                            ),
                        ),
                    )
                    .correlate_except(Location),
                ),
            ]
        )
    explicit = (
        select(Assignment.id)
        .join(
            PermissionProfile, PermissionProfile.id == Assignment.permission_profile_id
        )
        .join(
            PermissionProfilePermission,
            PermissionProfilePermission.permission_profile_id == PermissionProfile.id,
        )
        .join(
            PermissionDefinition,
            PermissionDefinition.id
            == PermissionProfilePermission.permission_definition_id,
        )
        .join(Scope, Scope.profile_assignment_id == Assignment.id)
        .where(
            Assignment.company_membership_id == CompanyMembership.id,
            Assignment.company_id == company_id,
            Assignment.is_active.is_(True),
            PermissionProfile.company_id == company_id,
            PermissionProfile.is_active.is_(True),
            PermissionDefinition.is_active.is_(True),
            PermissionDefinition.code.in_(capabilities),
            Scope.company_id == company_id,
            or_(*scope_matches),
        )
        .correlate_except(
            Assignment,
            PermissionProfile,
            PermissionProfilePermission,
            PermissionDefinition,
            Scope,
        )
        .exists()
    )
    return (
        select(User.id)
        .join(Role, Role.id == User.role_id)
        .outerjoin(
            CompanyMembership,
            and_(
                CompanyMembership.user_id == User.id,
                CompanyMembership.company_id == company_id,
            ),
        )
        .where(
            User.company_id == company_id,
            User.is_active.is_(True),
            Role.name.in_(("admin", "manager", "viewer")),
            ~User.email.endswith("@invalid.workhive.local"),
            or_(CompanyMembership.id.is_(None), CompanyMembership.status == "active"),
            or_(legacy, explicit),
        )
    )
