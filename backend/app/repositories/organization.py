from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.company_membership import (
    CompanyMembership,
    Department,
    DepartmentMembership,
    Team,
    TeamMembership,
)
from app.models.location import Location
from app.models.permission_profile import (
    MembershipPermissionProfileAssignment,
    MembershipPermissionProfileScope,
    PermissionDefinition,
    PermissionProfile,
    PermissionProfilePermission,
)
from app.models.user import User


def get_company_membership(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
) -> CompanyMembership | None:
    return (
        db.query(CompanyMembership)
        .options(joinedload(CompanyMembership.user).joinedload(User.role))
        .filter(
            CompanyMembership.company_id == company_id,
            CompanyMembership.id == membership_id,
        )
        .first()
    )


def get_user_membership(
    db: Session,
    *,
    company_id: int,
    user_id: int,
) -> CompanyMembership | None:
    return (
        db.query(CompanyMembership)
        .filter(
            CompanyMembership.company_id == company_id,
            CompanyMembership.user_id == user_id,
        )
        .first()
    )


def list_company_memberships(db: Session, company_id: int) -> list[CompanyMembership]:
    return (
        db.query(CompanyMembership)
        .options(joinedload(CompanyMembership.user).joinedload(User.role))
        .filter(CompanyMembership.company_id == company_id)
        .order_by(CompanyMembership.status.asc(), CompanyMembership.id.asc())
        .all()
    )


def list_department_memberships(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
) -> list[DepartmentMembership]:
    return (
        db.query(DepartmentMembership)
        .filter(
            DepartmentMembership.company_id == company_id,
            DepartmentMembership.company_membership_id == membership_id,
            DepartmentMembership.is_active.is_(True),
        )
        .all()
    )


def list_team_memberships(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
) -> list[TeamMembership]:
    return (
        db.query(TeamMembership)
        .filter(
            TeamMembership.company_id == company_id,
            TeamMembership.company_membership_id == membership_id,
            TeamMembership.is_active.is_(True),
        )
        .all()
    )


def list_team_member_assignments(
    db: Session,
    *,
    company_id: int,
    team_id: int,
) -> list[TeamMembership]:
    return (
        db.query(TeamMembership)
        .filter(
            TeamMembership.company_id == company_id,
            TeamMembership.team_id == team_id,
            TeamMembership.is_active.is_(True),
        )
        .all()
    )


def list_profile_assignments(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
) -> list[MembershipPermissionProfileAssignment]:
    return (
        db.query(MembershipPermissionProfileAssignment)
        .options(
            joinedload(MembershipPermissionProfileAssignment.permission_profile),
            selectinload(MembershipPermissionProfileAssignment.scopes),
        )
        .filter(
            MembershipPermissionProfileAssignment.company_id == company_id,
            MembershipPermissionProfileAssignment.company_membership_id
            == membership_id,
            MembershipPermissionProfileAssignment.is_active.is_(True),
        )
        .order_by(MembershipPermissionProfileAssignment.id.asc())
        .all()
    )


def list_departments(db: Session, company_id: int) -> list[Department]:
    return (
        db.query(Department)
        .filter(Department.company_id == company_id)
        .order_by(
            Department.is_active.desc(), Department.name.asc(), Department.id.asc()
        )
        .all()
    )


def get_department(
    db: Session, *, company_id: int, department_id: int
) -> Department | None:
    return (
        db.query(Department)
        .filter(Department.company_id == company_id, Department.id == department_id)
        .first()
    )


def list_teams(db: Session, company_id: int) -> list[Team]:
    return (
        db.query(Team)
        .filter(Team.company_id == company_id)
        .order_by(Team.is_active.desc(), Team.name.asc(), Team.id.asc())
        .all()
    )


def get_team(db: Session, *, company_id: int, team_id: int) -> Team | None:
    return (
        db.query(Team).filter(Team.company_id == company_id, Team.id == team_id).first()
    )


def get_team_usage(
    db: Session,
    *,
    company_id: int,
    team_id: int,
) -> dict[str, int]:
    member_assignments = (
        db.query(func.count(TeamMembership.id))
        .filter(
            TeamMembership.company_id == company_id,
            TeamMembership.team_id == team_id,
        )
        .scalar()
        or 0
    )
    active_member_assignments = (
        db.query(func.count(TeamMembership.id))
        .filter(
            TeamMembership.company_id == company_id,
            TeamMembership.team_id == team_id,
            TeamMembership.is_active.is_(True),
        )
        .scalar()
        or 0
    )
    profile_scopes = (
        db.query(func.count(MembershipPermissionProfileScope.id))
        .filter(
            MembershipPermissionProfileScope.company_id == company_id,
            MembershipPermissionProfileScope.scope_type == "team",
            MembershipPermissionProfileScope.scope_id == team_id,
        )
        .scalar()
        or 0
    )
    active_profile_scopes = (
        db.query(func.count(MembershipPermissionProfileScope.id))
        .join(
            MembershipPermissionProfileAssignment,
            MembershipPermissionProfileAssignment.id
            == MembershipPermissionProfileScope.profile_assignment_id,
        )
        .filter(
            MembershipPermissionProfileScope.company_id == company_id,
            MembershipPermissionProfileScope.scope_type == "team",
            MembershipPermissionProfileScope.scope_id == team_id,
            MembershipPermissionProfileAssignment.is_active.is_(True),
        )
        .scalar()
        or 0
    )
    locations = (
        db.query(func.count(Location.id))
        .filter(
            Location.owner_company_id == company_id,
            Location.team_id == team_id,
        )
        .scalar()
        or 0
    )
    return {
        "member_assignments": int(member_assignments),
        "active_member_assignments": int(active_member_assignments),
        "profile_scopes": int(profile_scopes),
        "active_profile_scopes": int(active_profile_scopes),
        "locations": int(locations),
    }


def list_permission_definitions(db: Session) -> list[PermissionDefinition]:
    return (
        db.query(PermissionDefinition)
        .filter(PermissionDefinition.is_active.is_(True))
        .order_by(PermissionDefinition.category.asc(), PermissionDefinition.code.asc())
        .all()
    )


def get_permission_definitions_by_codes(
    db: Session,
    codes: list[str],
) -> list[PermissionDefinition]:
    if not codes:
        return []
    return (
        db.query(PermissionDefinition)
        .filter(
            PermissionDefinition.is_active.is_(True),
            PermissionDefinition.code.in_(codes),
        )
        .all()
    )


def list_permission_profiles(db: Session, company_id: int) -> list[PermissionProfile]:
    return (
        db.query(PermissionProfile)
        .options(
            selectinload(PermissionProfile.permissions).joinedload(
                PermissionProfilePermission.permission_definition
            )
        )
        .filter(PermissionProfile.company_id == company_id)
        .order_by(PermissionProfile.is_system.desc(), PermissionProfile.name.asc())
        .all()
    )


def get_permission_profile(
    db: Session,
    *,
    company_id: int,
    profile_id: int,
) -> PermissionProfile | None:
    return (
        db.query(PermissionProfile)
        .options(
            selectinload(PermissionProfile.permissions).joinedload(
                PermissionProfilePermission.permission_definition
            )
        )
        .filter(
            PermissionProfile.company_id == company_id,
            PermissionProfile.id == profile_id,
        )
        .first()
    )


def get_permission_profile_usage(
    db: Session,
    *,
    company_id: int,
    profile_id: int,
) -> dict[str, int]:
    assignments = (
        db.query(func.count(MembershipPermissionProfileAssignment.id))
        .filter(
            MembershipPermissionProfileAssignment.company_id == company_id,
            MembershipPermissionProfileAssignment.permission_profile_id == profile_id,
        )
        .scalar()
        or 0
    )
    return {"assignments": int(assignments)}


def get_system_administrator_profile(
    db: Session,
    company_id: int,
) -> PermissionProfile | None:
    return (
        db.query(PermissionProfile)
        .options(selectinload(PermissionProfile.permissions))
        .filter(
            PermissionProfile.company_id == company_id,
            PermissionProfile.is_system.is_(True),
            PermissionProfile.name == "Administrador de empresa",
        )
        .first()
    )


def get_permission_profile_assignment(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
    profile_id: int,
) -> MembershipPermissionProfileAssignment | None:
    return (
        db.query(MembershipPermissionProfileAssignment)
        .filter(
            MembershipPermissionProfileAssignment.company_id == company_id,
            MembershipPermissionProfileAssignment.company_membership_id
            == membership_id,
            MembershipPermissionProfileAssignment.permission_profile_id == profile_id,
        )
        .first()
    )


def has_permission_in_scope(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
    permission_code: str,
    scope_type: str,
    scope_id: int,
    require_system_profile: bool = False,
) -> bool:
    scope_matches = [
        (
            MembershipPermissionProfileScope.scope_type == "company",
            MembershipPermissionProfileScope.scope_id == company_id,
        ),
        (
            MembershipPermissionProfileScope.scope_type == scope_type,
            MembershipPermissionProfileScope.scope_id == scope_id,
        ),
    ]
    query = (
        db.query(MembershipPermissionProfileAssignment.id)
        .join(
            PermissionProfile,
            PermissionProfile.id
            == MembershipPermissionProfileAssignment.permission_profile_id,
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
        .join(
            MembershipPermissionProfileScope,
            MembershipPermissionProfileScope.profile_assignment_id
            == MembershipPermissionProfileAssignment.id,
        )
        .filter(
            MembershipPermissionProfileAssignment.company_id == company_id,
            MembershipPermissionProfileAssignment.company_membership_id
            == membership_id,
            MembershipPermissionProfileAssignment.is_active.is_(True),
            PermissionProfile.is_active.is_(True),
            PermissionDefinition.is_active.is_(True),
            PermissionDefinition.code == permission_code,
            or_(
                *[
                    scope_type_match & scope_id_match
                    for scope_type_match, scope_id_match in scope_matches
                ]
            ),
        )
    )
    if require_system_profile:
        query = query.filter(PermissionProfile.is_system.is_(True))
    return query.first() is not None


def list_permission_scope_ids(
    db: Session,
    *,
    company_id: int,
    membership_id: int,
    permission_code: str,
    scope_type: str,
    require_system_profile: bool = False,
) -> list[int]:
    """Return explicit targets for an active permission assignment.

    Callers must check a company-wide scope first. This helper intentionally
    returns only exact targets, so a department or team assignment cannot be
    mistaken for access to an unrelated record.
    """

    query = (
        db.query(MembershipPermissionProfileScope.scope_id)
        .join(
            MembershipPermissionProfileAssignment,
            MembershipPermissionProfileAssignment.id
            == MembershipPermissionProfileScope.profile_assignment_id,
        )
        .join(
            PermissionProfile,
            PermissionProfile.id
            == MembershipPermissionProfileAssignment.permission_profile_id,
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
        .filter(
            MembershipPermissionProfileScope.company_id == company_id,
            MembershipPermissionProfileScope.scope_type == scope_type,
            MembershipPermissionProfileAssignment.company_id == company_id,
            MembershipPermissionProfileAssignment.company_membership_id
            == membership_id,
            MembershipPermissionProfileAssignment.is_active.is_(True),
            PermissionProfile.is_active.is_(True),
            PermissionDefinition.is_active.is_(True),
            PermissionDefinition.code == permission_code,
        )
    )
    if require_system_profile:
        query = query.filter(PermissionProfile.is_system.is_(True))
    return sorted({scope_id for (scope_id,) in query.all()})


def list_location_ids_for_organization_scopes(
    db: Session,
    *,
    company_id: int,
    department_ids: set[int],
    team_ids: set[int],
) -> list[int]:
    """Resolve organizational scopes only against locations owned by the company."""

    filters = []
    if department_ids:
        filters.append(Location.department_id.in_(department_ids))
    if team_ids:
        filters.append(Location.team_id.in_(team_ids))
    if not filters:
        return []
    return [
        location_id
        for (location_id,) in (
            db.query(Location.id)
            .filter(
                Location.owner_company_id == company_id,
                Location.is_active.is_(True),
                or_(*filters),
            )
            .all()
        )
    ]


def is_valid_scope_target(
    db: Session,
    *,
    company_id: int,
    scope_type: str,
    scope_id: int,
) -> bool:
    if scope_type == "company":
        return scope_id == company_id
    if scope_type == "department":
        return (
            get_department(db, company_id=company_id, department_id=scope_id)
            is not None
        )
    if scope_type == "team":
        return get_team(db, company_id=company_id, team_id=scope_id) is not None
    if scope_type == "location":
        return (
            db.query(Location.id)
            .filter(
                Location.id == scope_id,
                or_(
                    Location.managing_company_id == company_id,
                    Location.owner_company_id == company_id,
                ),
            )
            .first()
            is not None
        )
    return False
