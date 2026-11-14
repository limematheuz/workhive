"""Scoped authorization policy for the operational task-assignee directory."""

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.company_membership import (
    CompanyMembership,
    DepartmentMembership,
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
from app.models.task_item import TaskItem
from app.models.task_structure import TaskAssignment
from app.models.user import User
from app.repositories import organization as organization_repo
from app.repositories import user as user_repo
from app.services.organization_authorization_service import (
    has_capability,
    permitted_location_ids,
)
from app.services.user_scope import is_platform_superadmin, require_company_context

OPERATIONAL_SCOPE_CAPABILITIES = (
    "work.read",
    "work.manage",
    "time.manage",
    "time.read",
    "locations.read",
    "locations.manage",
)


def _resolve_scoped_candidate_user_ids(
    db: Session,
    *,
    company_id: int,
    current_user: User,
    target_location_ids: set[int],
    extra_department_ids: set[int],
    extra_team_ids: set[int],
) -> set[int]:
    if not target_location_ids and not extra_department_ids and not extra_team_ids:
        return set()

    department_ids = set(extra_department_ids)
    team_ids = set(extra_team_ids)
    if target_location_ids:
        location_rows = (
            db.query(Location.department_id, Location.team_id)
            .filter(
                Location.id.in_(target_location_ids),
                Location.is_active.is_(True),
                or_(
                    Location.owner_company_id == company_id,
                    Location.managing_company_id == company_id,
                ),
            )
            .all()
        )
        for dept_id, tm_id in location_rows:
            if dept_id is not None:
                department_ids.add(dept_id)
            if tm_id is not None:
                team_ids.add(tm_id)

    candidate_ids: set[int] = {current_user.id}

    if department_ids:
        dept_users = (
            db.query(CompanyMembership.user_id)
            .join(
                DepartmentMembership,
                DepartmentMembership.company_membership_id == CompanyMembership.id,
            )
            .filter(
                CompanyMembership.company_id == company_id,
                CompanyMembership.status == "active",
                DepartmentMembership.company_id == company_id,
                DepartmentMembership.is_active.is_(True),
                DepartmentMembership.department_id.in_(department_ids),
            )
            .all()
        )
        candidate_ids.update(user_id for (user_id,) in dept_users)

    if team_ids:
        team_users = (
            db.query(CompanyMembership.user_id)
            .join(
                TeamMembership,
                TeamMembership.company_membership_id == CompanyMembership.id,
            )
            .filter(
                CompanyMembership.company_id == company_id,
                CompanyMembership.status == "active",
                TeamMembership.company_id == company_id,
                TeamMembership.is_active.is_(True),
                TeamMembership.team_id.in_(team_ids),
            )
            .all()
        )
        candidate_ids.update(user_id for (user_id,) in team_users)

    scope_clauses = []
    if target_location_ids:
        scope_clauses.append(
            (MembershipPermissionProfileScope.scope_type == "location")
            & MembershipPermissionProfileScope.scope_id.in_(target_location_ids)
        )
    if department_ids:
        scope_clauses.append(
            (MembershipPermissionProfileScope.scope_type == "department")
            & MembershipPermissionProfileScope.scope_id.in_(department_ids)
        )
    if team_ids:
        scope_clauses.append(
            (MembershipPermissionProfileScope.scope_type == "team")
            & MembershipPermissionProfileScope.scope_id.in_(team_ids)
        )

    if scope_clauses:
        scoped_profile_users = (
            db.query(CompanyMembership.user_id)
            .join(
                MembershipPermissionProfileAssignment,
                MembershipPermissionProfileAssignment.company_membership_id
                == CompanyMembership.id,
            )
            .join(
                PermissionProfile,
                PermissionProfile.id
                == MembershipPermissionProfileAssignment.permission_profile_id,
            )
            .join(
                PermissionProfilePermission,
                PermissionProfilePermission.permission_profile_id
                == PermissionProfile.id,
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
                CompanyMembership.company_id == company_id,
                CompanyMembership.status == "active",
                MembershipPermissionProfileAssignment.company_id == company_id,
                MembershipPermissionProfileAssignment.is_active.is_(True),
                PermissionProfile.is_active.is_(True),
                PermissionDefinition.is_active.is_(True),
                PermissionDefinition.code.in_(OPERATIONAL_SCOPE_CAPABILITIES),
                or_(*scope_clauses),
            )
            .all()
        )
        candidate_ids.update(user_id for (user_id,) in scoped_profile_users)

    if target_location_ids:
        direct_task_users = (
            db.query(TaskItem.user_id)
            .filter(
                TaskItem.company_id == company_id,
                TaskItem.location_id.in_(target_location_ids),
                TaskItem.user_id.isnot(None),
            )
            .all()
        )
        candidate_ids.update(user_id for (user_id,) in direct_task_users if user_id)

        structured_task_users = (
            db.query(TaskAssignment.user_id)
            .join(TaskItem, TaskItem.id == TaskAssignment.task_id)
            .filter(
                TaskItem.company_id == company_id,
                TaskItem.location_id.in_(target_location_ids),
            )
            .all()
        )
        candidate_ids.update(user_id for (user_id,) in structured_task_users if user_id)

    return candidate_ids


def resolve_assignable_directory_scope(
    db: Session,
    current_user: User,
    location_id: int | None = None,
) -> tuple[int, set[int] | None]:
    """Return ``(company_id, allowed_user_ids)`` where ``None`` means company-wide."""

    if is_platform_superadmin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrators must not use a customer company context",
        )
    company_id = require_company_context(current_user)

    if location_id is not None and not organization_repo.is_valid_scope_target(
        db,
        company_id=company_id,
        scope_type="location",
        scope_id=location_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )

    if has_capability(db, current_user, "access.members.read") or has_capability(
        db, current_user, "work.manage"
    ):
        return company_id, None

    if location_id is not None:
        if not has_capability(
            db,
            current_user,
            "work.manage",
            scope_type="location",
            scope_id=location_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return company_id, _resolve_scoped_candidate_user_ids(
            db,
            company_id=company_id,
            current_user=current_user,
            target_location_ids={location_id},
            extra_department_ids=set(),
            extra_team_ids=set(),
        )

    permitted_locations = permitted_location_ids(db, current_user, "work.manage")
    if permitted_locations is None:
        return company_id, None

    membership = organization_repo.get_user_membership(
        db, company_id=company_id, user_id=current_user.id
    )
    dept_ids = (
        set(
            organization_repo.list_permission_scope_ids(
                db,
                company_id=company_id,
                membership_id=membership.id,
                permission_code="work.manage",
                scope_type="department",
            )
        )
        if membership
        else set()
    )
    team_ids = (
        set(
            organization_repo.list_permission_scope_ids(
                db,
                company_id=company_id,
                membership_id=membership.id,
                permission_code="work.manage",
                scope_type="team",
            )
        )
        if membership
        else set()
    )
    return company_id, _resolve_scoped_candidate_user_ids(
        db,
        company_id=company_id,
        current_user=current_user,
        target_location_ids=permitted_locations,
        extra_department_ids=dept_ids,
        extra_team_ids=team_ids,
    )


def list_assignable_users(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 200,
    location_id: int | None = None,
) -> list[User]:
    company_id, allowed_ids = resolve_assignable_directory_scope(
        db, current_user, location_id=location_id
    )
    return user_repo.get_assignable_users(
        db, company_id, skip, limit, allowed_user_ids=allowed_ids
    )
