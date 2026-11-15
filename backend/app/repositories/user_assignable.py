"""Read candidate user IDs within an already authorized operational scope."""

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


def get_scoped_candidate_user_ids(
    db: Session,
    *,
    company_id: int,
    operational_scope_capabilities: tuple[str, ...],
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

    candidate_ids: set[int] = set()

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
                PermissionDefinition.code.in_(operational_scope_capabilities),
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
