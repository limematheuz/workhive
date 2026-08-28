from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.services import organization_authorization_service
from app.services.user_scope import require_company_context


CAPABILITY_MEMBERS_READ = "access.members.read"
CAPABILITY_MEMBERS_MANAGE = "access.members.manage"
CAPABILITY_PROFILES_READ = "access.profiles.read"
CAPABILITY_PROFILES_MANAGE = "access.profiles.manage"
CAPABILITY_SCOPES_MANAGE = "access.scopes.manage"
CAPABILITY_DEPARTMENTS_READ = "organization.departments.read"
CAPABILITY_DEPARTMENTS_MANAGE = "organization.departments.manage"
CAPABILITY_TEAMS_READ = "organization.teams.read"
CAPABILITY_TEAMS_MANAGE = "organization.teams.manage"


def require_capability(db: Session, current_user: User, capability: str) -> int:
    organization_authorization_service.require_capability(db, current_user, capability)
    return require_company_context(current_user)


def not_found(entity: str) -> None:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity} not found")


def conflict(message: str) -> None:
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)
