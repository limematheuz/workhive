from sqlalchemy.orm import Session

from app.models.user import User
from app.services.organization_authorization_service import has_capability


ORGANIZATION_CAPABILITIES = (
    "access.members.read", "access.members.manage",
    "access.profiles.read", "access.profiles.manage",
    "organization.departments.read", "organization.departments.manage",
    "organization.teams.read", "organization.teams.manage",
    "inventory.read", "inventory.manage",
    "locations.read",
    "quality.templates.read", "quality.templates.manage",
    "quality.inspections.read", "quality.inspections.manage",
    "quality.incidents.read", "quality.incidents.manage",
    "quality.complaints.read", "quality.complaints.manage",
)


def access_summary(db: Session, current_user: User) -> dict[str, bool]:
    """Presentation hints from the same policy that guards every operation."""
    return {code: has_capability(db, current_user, code) for code in ORGANIZATION_CAPABILITIES}
