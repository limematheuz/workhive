"""Current identity serialization and canonical workspace presentation hints."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserResponse
from app.services import organization_authorization_service
from app.services.quality_workspace_access_service import quality_workspace_access


def _location_access_hints(
    db: Session, user: User, read: str, manage: str
) -> tuple[bool, bool]:
    try:
        readable, editable, _ = (
            organization_authorization_service.resolve_location_capabilities(
                db, user, read_capability=read, manage_capability=manage
            )
        )
    except HTTPException:
        return False, False
    return readable is None or bool(readable), editable is None or bool(editable)


def build_current_user_response(db: Session, current_user: User) -> UserResponse:
    response = UserResponse.model_validate(current_user)
    if current_user.role.name == "partner_portal" or current_user.company_id is None:
        return response
    quality_access = quality_workspace_access(db, current_user)
    work_read, work_manage = _location_access_hints(
        db, current_user, "work.read", "work.manage"
    )
    location_read, _ = _location_access_hints(
        db, current_user, "locations.read", "locations.manage"
    )
    catalog_manage = organization_authorization_service.has_capability(
        db, current_user, "work.manage"
    )
    return response.model_copy(
        update={
            "can_view_tasks": work_read,
            "can_manage_tasks": work_manage,
            "can_view_locations": location_read,
            "can_manage_service_catalog": catalog_manage,
            "can_view_finance": organization_authorization_service.has_capability(
                db, current_user, "finance.read"
            ),
            "can_manage_finance": organization_authorization_service.has_capability(
                db, current_user, "finance.manage"
            ),
            "can_view_labor_costs": organization_authorization_service.has_capability(
                db, current_user, "labor_costs.read"
            ),
            "can_manage_labor_costs": organization_authorization_service.has_capability(
                db, current_user, "labor_costs.manage"
            ),
            "can_view_quality": any(
                section.can_read for section in quality_access.sections.values()
            ),
            "can_manage_quality": any(
                section.can_manage for section in quality_access.sections.values()
            ),
            "can_manage_time": organization_authorization_service.has_capability(
                db, current_user, "time.manage"
            ),
            "can_approve_time": organization_authorization_service.has_capability(
                db, current_user, "time.approve"
            ),
            "can_view_work_reports": organization_authorization_service.has_capability(
                db, current_user, "work.read"
            ),
            "can_manage_work_reports": organization_authorization_service.has_capability(
                db, current_user, "work.manage"
            ),
        }
    )
