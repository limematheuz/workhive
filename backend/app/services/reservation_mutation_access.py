"""Authorize a reservation mutation without coupling portal policy to its domain service."""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.user import User
from app.services import location_access_service
from app.services.planning_access_service import (
    require_company_planning,
    require_user_planning,
)


@dataclass(frozen=True)
class ReservationMutationAccess:
    """Explicit alternate authority for a narrowly scoped reservation caller."""

    planning_company_id: int
    allow_partner_portal_owner: bool = False


def require_reservation_mutation_access(
    db: Session,
    current_user: User,
    location_id: int,
    *,
    access: ReservationMutationAccess | None,
) -> None:
    if access is None:
        require_user_planning(db, current_user)
    else:
        require_company_planning(db, access.planning_company_id)
    location_access_service.require_location_capability(
        db,
        current_user,
        location_id,
        "can_manage_reservations",
        allow_partner_portal_owner=bool(access and access.allow_partner_portal_owner),
    )
