from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company_membership import CompanyMembership
from app.models.company import Company
from app.models.external_access_grant import ExternalAccessGrant
from app.models.user import User
from app.repositories import organization as organization_repo
from app.repositories.organization_legacy_viewer_locations import (
    list_legacy_viewer_location_ids,
)
from app.services.entitlement_service import require_feature
from app.services.external_access_policy import require_external_company_capability
from app.services.organization_location_scope_service import (
    resolve_permitted_location_ids,
)
from app.services.organization_legacy_authorization_service import (
    has_explicit_profile_assignments,
)
from app.services.organization_permission_policy import (
    feature_code_for_capability,
    is_system_only_permission,
)
from app.services.initial_membership_policy import operational_role_allows,is_initial_worker
from app.services.user_scope import (
    is_platform_superadmin,
    require_company_context,
    role_name,
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
    feature_code = feature_code_for_capability(capability)
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
    membership = getattr(current_user,"active_membership",None)
    if membership is None or membership.company_id!=company_id or membership.user_id!=current_user.id:
        membership = organization_repo.get_user_membership(db,company_id=company_id,user_id=current_user.id)
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
    from app.services.company_session_principal import CompanyUser
    if isinstance(current_user, CompanyUser):
        current_user.active_membership = membership
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
    legacy_allowed = operational_role_allows(
        db,
        current_user,
        capability,
        company_id=company_id,
        membership=membership,
    )
    if legacy_allowed and not (
        capability == "locations.read"
        and role_name(current_user) == "viewer"
        and scope_type == "location"
    ):
        return membership
    if (
        legacy_allowed
        and scope_type == "location"
        and scope_id
        in list_legacy_viewer_location_ids(
            db, company_id=company_id, user_id=current_user.id
        )
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
    """Whether operative reads need the role-based own-assignment filter.

    This does not grant a capability: the canonical resolver checks the legacy
    base or the separate verified initial membership policy first.
    """

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
    return resolve_location_read_scope(db, current_user, capability)[0]


def resolve_location_read_scope(
    db: Session,
    current_user: User,
    capability: str,
) -> tuple[set[int] | None, bool]:
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
    if operational_role_allows(
        db,
        current_user,
        capability,
        company_id=company_id,
        membership=membership,
    ):
        if role_name(current_user) == "viewer" and (capability == "locations.read" or is_initial_worker(db,current_user)):
            return list_legacy_viewer_location_ids(
                db, company_id=company_id, user_id=current_user.id
            ), True
        return None, True
    return resolve_permitted_location_ids(
        db,
        company_id=company_id,
        membership=membership,
        capability=capability,
    ), False


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
    if operational_role_allows(
        db,
        current_user,
        read_capability,
        company_id=company_id,
        membership=membership,
        has_explicit_assignments=has_explicit_assignments,
    ):
        legacy_manage_locations = (
            None
            if operational_role_allows(
                db,
                current_user,
                manage_capability,
                company_id=company_id,
                membership=membership,
                has_explicit_assignments=has_explicit_assignments,
            )
            else set()
        )
        legacy_read_locations = (
            list_legacy_viewer_location_ids(db, company_id=company_id, user_id=current_user.id)
            if (read_capability == "locations.read" and role_name(current_user) == "viewer")
            or is_initial_worker(db, current_user)
            else None
        )
        return legacy_read_locations, legacy_manage_locations, True
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
