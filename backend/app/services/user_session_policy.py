"""Session revocation decisions for the administrative user workflow."""

from app.models.user import User
from app.schemas.user import UserUpdate


def requires_session_revocation(user: User, update: UserUpdate) -> bool:
    if update.password is not None:
        return True
    return any(
        field in update.model_fields_set
        and getattr(update, field) is not None
        and getattr(update, field) != getattr(user, field)
        for field in ("is_active", "role_id")
    )
