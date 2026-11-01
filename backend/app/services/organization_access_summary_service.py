from sqlalchemy.orm import Session

from app.models.user import User
from app.services.organization_authorization_service import has_capability
from app.services.quality_workspace_access_service import quality_workspace_access


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
    quality = quality_workspace_access(db, current_user)
    summary = {}
    for code in ORGANIZATION_CAPABILITIES:
        if code.startswith("quality."):
            _, section, operation = code.split(".")
            scope = quality.sections[section]
            summary[code] = scope.can_read if operation == "read" else scope.can_manage
        elif code == "locations.read":
            summary[code] = quality.can_read_locations
        else:
            summary[code] = has_capability(db, current_user, code)
    return summary
