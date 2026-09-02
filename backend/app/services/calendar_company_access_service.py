from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.planning_access_service import require_user_planning
from app.services.user_scope import role_name


def require_company_calendar_role(
    db: Session,
    user: User,
    allowed_roles: set[str],
) -> int:
    if user.company_id is None or role_name(user) not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company calendar access is not permitted",
        )
    require_user_planning(db, user)
    return user.company_id
