from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.user import User
from app.services.entitlement_service import (
    company_feature_enabled,
    require_company_feature,
)
from app.services import organization_authorization_service
from app.services.user_scope import is_platform_superadmin, role_name


PLANNING_FEATURE_CODE = "features.planning"


def require_company_planning(db: Session, company_id: int) -> None:
    require_company_feature(
        db,
        company_id=company_id,
        code=PLANNING_FEATURE_CODE,
    )


def require_user_planning(db: Session, user: User) -> None:
    if user.company_id is not None:
        require_company_planning(db, user.company_id)


def company_planning_enabled(db: Session, company_id: int) -> bool:
    return company_feature_enabled(
        db,
        company_id=company_id,
        code=PLANNING_FEATURE_CODE,
    )


def reservation_reader_location_scope(db: Session, user: User) -> set[int] | None:
    """Preserve management readers and admit explicitly delegated operations.

    Ordinary workers never acquire the guest-planning feed through locations
    read access alone. Delegated readers stay within their work-management
    scope; every caller also needs its canonical locations.read scope.
    """
    if is_platform_superadmin(user) or role_name(user) in {"admin", "manager"}:
        return None
    permitted = organization_authorization_service.permitted_location_ids(db, user, "work.manage")
    if permitted is not None and not permitted:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return permitted
