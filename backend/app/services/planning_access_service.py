from sqlalchemy.orm import Session

from app.models.user import User
from app.services.entitlement_service import (
    company_feature_enabled,
    require_company_feature,
)


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
