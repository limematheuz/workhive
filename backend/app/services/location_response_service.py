"""Project loaded locations into the capabilities and private fields allowed by a read."""

from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.user import User
from app.schemas.location import LocationResponse
from app.services import location_access_service


def build_location_response(
    db: Session,
    user: User,
    location: Location,
    *,
    work_manage_location_ids: set[int] | None,
) -> LocationResponse:
    response = LocationResponse.model_validate(location)
    response.can_manage_reservations = (
        location_access_service.has_location_capability_loaded(
            user,
            location,
            "can_manage_reservations",
            profile_allows_work=(
                work_manage_location_ids is None
                or location.id in work_manage_location_ids
            ),
        )
    )
    response.can_manage_tasks = location_access_service.has_location_capability_loaded(
        user,
        location,
        "can_manage_tasks",
        profile_allows_work=(
            work_manage_location_ids is None or location.id in work_manage_location_ids
        ),
    )
    response.can_manage_location = location_access_service.can_manage_owned_location(
        db, user, location
    )
    response.shared_companies = [
        access.company_id for access in location.company_access
    ]
    if not location_access_service.can_view_sensitive_loaded(user, location):
        response.access = None
    return response
