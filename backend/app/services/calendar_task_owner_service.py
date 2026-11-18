from app.repositories.company_membership_scope import company_role_predicate
from sqlalchemy.orm import Session

from app.models.google_calendar_connection import GoogleCalendarConnection
from app.models.role import Role
from app.models.user import User


CALENDAR_OWNER_ROLES = ("admin",)


def resolve_calendar_owner_user_id(
    db: Session,
    company_id: int,
    preferred_user_id: int | None = None,
) -> int | None:
    """Choose the user whose Google calendar should own company task events."""
    if preferred_user_id:
        preferred_connection = (
            db.query(GoogleCalendarConnection)
            .filter(
                GoogleCalendarConnection.company_id == company_id,
                GoogleCalendarConnection.owner_user_id == preferred_user_id,
                GoogleCalendarConnection.status == "connected",
            )
            .first()
        )
        if preferred_connection:
            return preferred_user_id

    connected_owner = (
        db.query(GoogleCalendarConnection.owner_user_id)
        .join(User, User.id == GoogleCalendarConnection.owner_user_id)
        .join(Role, Role.id == User.role_id)
        .filter(
            GoogleCalendarConnection.company_id == company_id,
            GoogleCalendarConnection.status == "connected",
            User.is_active.is_(True),
        )
        .order_by(GoogleCalendarConnection.id.asc())
        .first()
    )
    if connected_owner:
        return connected_owner[0]

    preferred_admin = None
    if preferred_user_id:
        preferred_admin = (
            db.query(User.id)
            .join(Role, Role.id == User.role_id)
            .filter(
                User.id == preferred_user_id,
                company_role_predicate(company_id,CALENDAR_OWNER_ROLES),
                User.is_active.is_(True),
                )
            .first()
        )
    if preferred_admin:
        return preferred_admin[0]

    fallback_admin = (
        db.query(User.id)
        .join(Role, Role.id == User.role_id)
        .filter(
            company_role_predicate(company_id,CALENDAR_OWNER_ROLES),
            User.is_active.is_(True),
        )
        .order_by(User.id.asc())
        .first()
    )
    return fallback_admin[0] if fallback_admin else None
