from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company_membership import CompanyMembership
from app.models.company import Company
from app.models.external_access_grant import ExternalAccessGrant
from app.models.user import User
from app.repositories import organization as organization_repo
from app.services.entitlement_service import require_feature
from app.services.external_access_policy import require_external_company_capability
from app.services.organization_location_scope_service import (
    resolve_permitted_location_ids,
)
from app.services.organization_legacy_authorization_service import (
    has_explicit_profile_assignments,
    legacy_role_allows,
)
from app.services.organization_permission_policy import is_system_only_permission
from app.services.user_scope import (
    is_platform_superadmin,
    require_company_context,
)


def _require_active_company_principal(
    db: Session,
    current_user: User,
    capability: str,
) -> tuple[int, CompanyMembership | ExternalAccessGrant]:
    if is_platform_superadmin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrators must not use a customer company context",
        )

    company_id = require_company_context(current_user)
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
        )
    feature_code = {
        "organization.departments.read": "features.organization",
        "organization.departments.manage": "features.organization",
        "organization.teams.read": "features.teams",
        "organization.teams.manage": "features.teams",
        "clients.read": "features.clients",
        "clients.manage": "features.clients",
        "commercial.follow_ups.read": "features.clients",
        "commercial.follow_ups.manage": "features.clients",
        "locations.read": "features.locations",
        "locations.manage": "features.locations",
        "work.read": "features.work_orders",
        "work.manage": "features.work_orders",
        "time.read": "features.time_tracking",
        "time.manage": "features.time_tracking",
        "time.approve": "features.time_tracking",
        "quality.templates.read": "features.quality",
        "quality.templates.manage": "features.quality",
        "quality.inspections.read": "features.quality",
        "quality.inspections.manage": "features.quality",
        "quality.incidents.read": "features.quality",
        "quality.incidents.manage": "features.quality",
    }.get(capability)
    if feature_code:
        require_feature(db, company, feature_code)
    grant = require_external_company_capability(
        db,
        current_user=current_user,
        company_id=company_id,
        capability=capability,
    )
    if grant is not None:
        return company_id, grant
    membership = organization_repo.get_user_membership(
        db,
        company_id=company_id,
        user_id=current_user.id,
    )
    if not membership:
        from app.services.organization_bootstrap_service import ensure_legacy_membership

        membership = ensure_legacy_membership(
            db,
            current_user,
            existing_membership=membership,
        )
    if not membership or membership.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active company membership required",
        )
    return company_id, membership


def require_capability(
    db: Session,
    current_user: User,
    capability: str,
    *,
    scope_type: str = "company",
    scope_id: int | None = None,
) -> CompanyMembership | ExternalAccessGrant:
    """Enforce a company-scoped capability at the backend service boundary."""

    company_id, principal = _require_active_company_principal(
        db, current_user, capability
    )
    if isinstance(principal, ExternalAccessGrant):
        if scope_type != "company" or (
            scope_id is not None and scope_id != company_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return principal
    membership = principal

    target_id = scope_id if scope_id is not None else company_id
    if legacy_role_allows(
        db,
        current_user,
        capability,
        company_id=company_id,
        membership=membership,
    ):
        return membership
    if organization_repo.has_permission_in_scope(
        db,
        company_id=company_id,
        membership_id=membership.id,
        permission_code=capability,
        scope_type=scope_type,
        scope_id=target_id,
        require_system_profile=is_system_only_permission(capability),
    ):
        return membership
    if scope_type == "location" and scope_id is not None:
        permitted_ids = resolve_permitted_location_ids(
            db,
            company_id=company_id,
            membership=membership,
            capability=capability,
            required=False,
        )
        if permitted_ids is None or scope_id in permitted_ids:
            return membership
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Not enough permissions",
    )


def has_capability(
    db: Session,
    current_user: User,
    capability: str,
    *,
    scope_type: str = "company",
    scope_id: int | None = None,
) -> bool:
    """Return whether a capability is granted without weakening enforcement.

    Services use this only to choose between a broader management workflow and
    a worker's own-task workflow. Every mutating branch still calls
    :func:`require_capability` before changing data.
    """

    try:
        require_capability(
            db,
            current_user,
            capability,
            scope_type=scope_type,
            scope_id=scope_id,
        )
    except HTTPException:
        return False
    return True


def uses_legacy_role_authorization(
    db: Session,
    current_user: User,
    capability: str,
) -> bool:
    """Whether this user still relies on the temporary role compatibility path."""

    company_id, principal = _require_active_company_principal(
        db, current_user, capability
    )
    if isinstance(principal, ExternalAccessGrant):
        return False
    membership = principal
    return not has_explicit_profile_assignments(
        db,
        company_id=company_id,
        membership_id=membership.id,
    )


def permitted_location_ids(
    db: Session,
    current_user: User,
    capability: str,
) -> set[int] | None:
    """Resolve a capability to all locations or a finite explicit set.

    ``None`` means a company-wide assignment. Department and team scopes map
    only to locations explicitly owned by the company and assigned to that
    organizational unit; work orders inherit through ``location_id``.
    """

    company_id, principal = _require_active_company_principal(
        db, current_user, capability
    )
    if isinstance(principal, ExternalAccessGrant):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    membership = principal
    if legacy_role_allows(
        db,
        current_user,
        capability,
        company_id=company_id,
        membership=membership,
    ):
        return None
    return resolve_permitted_location_ids(
        db,
        company_id=company_id,
        membership=membership,
        capability=capability,
    )


def resolve_location_capabilities(
    db: Session,
    current_user: User,
    *,
    read_capability: str,
    manage_capability: str,
) -> tuple[set[int] | None, set[int] | None, bool]:
    """Resolve read/manage location access in one authorization pass.

    The tuple is ``(read_locations, manage_locations, uses_legacy_roles)``;
    ``None`` is company-wide. It avoids repeating membership and profile
    queries for every list request while keeping requested work orders limited
    to locations where the user can actually manage work.
    """

    company_id, principal = _require_active_company_principal(
        db,
        current_user,
        read_capability,
    )
    if isinstance(principal, ExternalAccessGrant):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    membership = principal
    has_explicit_assignments = has_explicit_profile_assignments(
        db,
        company_id=company_id,
        membership_id=membership.id,
    )
    if legacy_role_allows(
        db,
        current_user,
        read_capability,
        company_id=company_id,
        membership=membership,
        has_explicit_assignments=has_explicit_assignments,
    ):
        legacy_manage_locations = (
            None
            if legacy_role_allows(
                db,
                current_user,
                manage_capability,
                company_id=company_id,
                membership=membership,
                has_explicit_assignments=has_explicit_assignments,
            )
            else set()
        )
        return None, legacy_manage_locations, True
    return (
        resolve_permitted_location_ids(
            db,
            company_id=company_id,
            membership=membership,
            capability=read_capability,
        ),
        resolve_permitted_location_ids(
            db,
            company_id=company_id,
            membership=membership,
            capability=manage_capability,
            required=False,
        ),
        False,
    )
