from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company_membership import CompanyMembership
from app.models.user import User
from app.repositories import organization as organization_repo
from app.repositories import company as company_repo
from app.services.entitlement_service import require_feature
from app.services.organization_permission_policy import is_system_only_permission
from app.services.user_scope import is_platform_superadmin, require_company_context


def require_capability(
    db: Session,
    current_user: User,
    capability: str,
    *,
    scope_type: str = "company",
    scope_id: int | None = None,
) -> CompanyMembership:
    """Enforce a company-scoped capability at the backend service boundary."""

    if is_platform_superadmin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrators must not use a customer company context",
        )

    company_id = require_company_context(current_user)
    company = company_repo.get_company_by_id(db, company_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
        )
    feature_code = {
        "organization.departments.read": "features.organization",
        "organization.departments.manage": "features.organization",
        "organization.teams.read": "features.teams",
        "organization.teams.manage": "features.teams",
    }.get(capability)
    if feature_code:
        require_feature(db, company, feature_code)
    membership = organization_repo.get_user_membership(
        db,
        company_id=company_id,
        user_id=current_user.id,
    )
    if not membership or membership.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active company membership required",
        )

    target_id = scope_id if scope_id is not None else company_id
    if not organization_repo.has_permission_in_scope(
        db,
        company_id=company_id,
        membership_id=membership.id,
        permission_code=capability,
        scope_type=scope_type,
        scope_id=target_id,
        require_system_profile=is_system_only_permission(capability),
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return membership
