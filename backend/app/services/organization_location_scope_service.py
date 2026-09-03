from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company_membership import CompanyMembership
from app.repositories import organization as organization_repo
from app.services.organization_permission_policy import is_system_only_permission


def resolve_permitted_location_ids(
    db: Session,
    *,
    company_id: int,
    membership: CompanyMembership,
    capability: str,
    required: bool = True,
) -> set[int] | None:
    """Resolve a capability to company-wide or explicitly assigned locations.

    Department and team assignments apply only to active locations owned by the
    same company. Direct location scopes remain supported alongside them.
    """

    system_only = is_system_only_permission(capability)
    if organization_repo.has_permission_in_scope(
        db,
        company_id=company_id,
        membership_id=membership.id,
        permission_code=capability,
        scope_type="company",
        scope_id=company_id,
        require_system_profile=system_only,
    ):
        return None

    location_ids = set(
        organization_repo.list_permission_scope_ids(
            db,
            company_id=company_id,
            membership_id=membership.id,
            permission_code=capability,
            scope_type="location",
            require_system_profile=system_only,
        )
    )
    department_ids = set(
        organization_repo.list_permission_scope_ids(
            db,
            company_id=company_id,
            membership_id=membership.id,
            permission_code=capability,
            scope_type="department",
            require_system_profile=system_only,
        )
    )
    team_ids = set(
        organization_repo.list_permission_scope_ids(
            db,
            company_id=company_id,
            membership_id=membership.id,
            permission_code=capability,
            scope_type="team",
            require_system_profile=system_only,
        )
    )
    location_ids.update(
        organization_repo.list_location_ids_for_organization_scopes(
            db,
            company_id=company_id,
            department_ids=department_ids,
            team_ids=team_ids,
        )
    )
    if location_ids:
        return location_ids
    if required:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return set()
