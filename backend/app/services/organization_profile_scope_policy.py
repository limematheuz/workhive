from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models.permission_profile import MembershipPermissionProfileAssignment
from app.repositories import organization as organization_repo
from app.repositories import organization_department as department_repo
from app.schemas.organization import OrganizationMemberProfileAssignmentInput
from app.services.organization_service_shared import conflict


def validate_profile_scopes(
    db: Session,
    *,
    company_id: int,
    assignments: Iterable[OrganizationMemberProfileAssignmentInput],
    existing_assignments: Iterable[MembershipPermissionProfileAssignment],
) -> None:
    existing_scope_keys = {
        (assignment.permission_profile_id, scope.scope_type, scope.scope_id)
        for assignment in existing_assignments
        for scope in assignment.scopes
    }
    for assignment in assignments:
        for scope in assignment.scopes:
            if scope.scope_type == "department":
                department = department_repo.get_department(
                    db, company_id=company_id, department_id=scope.scope_id
                )
                if not department:
                    conflict("A permission scope must belong to the same company")
                scope_key = (
                    assignment.permission_profile_id,
                    scope.scope_type,
                    scope.scope_id,
                )
                if not department.is_active and scope_key not in existing_scope_keys:
                    conflict("Inactive departments cannot receive new relationships")
                continue
            if scope.scope_type == "team":
                team = organization_repo.get_team(
                    db, company_id=company_id, team_id=scope.scope_id
                )
                if not team:
                    conflict("A permission scope must belong to the same company")
                scope_key = (
                    assignment.permission_profile_id,
                    scope.scope_type,
                    scope.scope_id,
                )
                if not team.is_active and scope_key not in existing_scope_keys:
                    conflict("Inactive teams cannot receive new relationships")
                continue
            if not organization_repo.is_valid_scope_target(
                db,
                company_id=company_id,
                scope_type=scope.scope_type,
                scope_id=scope.scope_id,
            ):
                conflict("A permission scope must belong to the same company")
