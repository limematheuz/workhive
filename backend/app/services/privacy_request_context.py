from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import user as user_repo


def request_company_id(db: Session, user: User) -> int | None:
    """Keep privacy requests attributable after a company removes a person."""

    if user.company_id is not None:
        return user.company_id
    latest_membership = user_repo.get_latest_company_membership(db, user.id)
    return latest_membership.company_id if latest_membership else None
