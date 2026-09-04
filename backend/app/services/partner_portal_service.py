"""Narrow property-manager operations exposed by the sponsored portal."""

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.partner_portal_grant import PartnerPortalGrant
from app.models.reservation import Reservation
from app.models.user import User
from app.repositories import location as location_repo
from app.repositories import reservation as reservation_repo
from app.schemas.location import LocationResponse
from app.schemas.reservation import ReservationCreate, ReservationResponse, ReservationUpdate
from app.services import reservation_query_service, reservation_service
from app.services.entitlement_service import require_company_feature
from app.services.planning_access_service import require_company_planning
from app.services.reservation_mutation_access import ReservationMutationAccess


def _require_locations_access(db: Session, grant: PartnerPortalGrant) -> None:
    require_company_feature(
        db,
        company_id=grant.host_company_id,
        code="features.locations",
    )


def _owned_location(db: Session, grant: PartnerPortalGrant, location_id: int) -> Location:
    location = location_repo.get_location_by_id(db, location_id, grant.partner_company_id)
    if (
        location is None
        or location.owner_company_id != grant.partner_company_id
        or not location.is_active
    ):
        raise HTTPException(status_code=404, detail="Property not found")
    return location


def _owned_reservation(
    db: Session,
    grant: PartnerPortalGrant,
    reservation_id: int,
) -> Reservation:
    reservation = reservation_repo.get_reservation(db, reservation_id)
    if (
        reservation is None
        or reservation.owner_company_id != grant.partner_company_id
        or reservation.location.owner_company_id != grant.partner_company_id
        or reservation.assigned_company_id != grant.host_company_id
    ):
        raise HTTPException(status_code=404, detail="Reservation not found")
    return reservation


def _reservation_response(
    db: Session,
    *,
    reservation: Reservation,
    current_user: User,
) -> ReservationResponse:
    response = reservation_query_service.build_reservation_response(
        db,
        reservation,
        current_user,
    )
    # The property manager owns these reservations but must never receive the
    # service provider's live worker locations.
    return response.model_copy(
        update={
            "notes": reservation.notes,
            "external_reference": reservation.external_reference,
            "cleaning_start_locations": [],
        }
    )


def list_locations(db: Session, *, grant: PartnerPortalGrant) -> list[LocationResponse]:
    _require_locations_access(db, grant)
    locations = location_repo.get_locations_by_client(
        db,
        grant.partner_company_id,
        skip=0,
        limit=10_000,
    )
    return [
        LocationResponse.model_validate(location).model_copy(
            update={
                "can_manage_reservations": True,
                "can_manage_tasks": False,
                "shared_companies": [access.company_id for access in location.company_access],
            }
        )
        for location in locations
        if location.owner_company_id == grant.partner_company_id
    ]


def list_reservations(
    db: Session,
    *,
    grant: PartnerPortalGrant,
    current_user: User,
    location_id: int | None,
    date_from: datetime | None,
    date_to: datetime | None,
) -> list[ReservationResponse]:
    require_company_planning(db, grant.host_company_id)
    if location_id is not None:
        _owned_location(db, grant, location_id)
    location_ids = [location.id for location in list_locations(db, grant=grant)]
    reservations = reservation_repo.list_reservations(
        db,
        location_ids,
        grant.partner_company_id,
        location_id,
        date_from,
        date_to,
    )
    return [
        _reservation_response(db, reservation=reservation, current_user=current_user)
        for reservation in reservations
        if (
            reservation.owner_company_id == grant.partner_company_id
            and reservation.assigned_company_id == grant.host_company_id
        )
    ]


def create_reservation(
    db: Session,
    *,
    grant: PartnerPortalGrant,
    current_user: User,
    data: ReservationCreate,
) -> ReservationResponse:
    require_company_planning(db, grant.host_company_id)
    _owned_location(db, grant, data.location_id)
    if not data.cleaning_required:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Partner portal reservations must include a cleaning request.",
        )
    if data.assigned_company_id not in {None, grant.host_company_id}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The sponsored service provider cannot be changed from this portal.",
        )
    reservation = reservation_service.create_reservation(
        db,
        current_user,
        data.model_copy(update={"assigned_company_id": grant.host_company_id}),
        access=ReservationMutationAccess(
            planning_company_id=grant.host_company_id,
            allow_partner_portal_owner=True,
        ),
    )
    return _reservation_response(db, reservation=reservation, current_user=current_user)


def update_reservation(
    db: Session,
    *,
    grant: PartnerPortalGrant,
    current_user: User,
    reservation_id: int,
    data: ReservationUpdate,
) -> ReservationResponse:
    require_company_planning(db, grant.host_company_id)
    _owned_reservation(db, grant, reservation_id)
    if data.cleaning_required is False:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Partner portal reservations must keep their cleaning request.",
        )
    if (
        "assigned_company_id" in data.model_fields_set
        and data.assigned_company_id != grant.host_company_id
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The sponsored service provider cannot be changed from this portal.",
        )
    reservation = reservation_service.update_reservation(
        db,
        current_user,
        reservation_id,
        data.model_copy(
            update={
                "assigned_company_id": grant.host_company_id,
                "cleaning_required": True,
            }
        ),
        access=ReservationMutationAccess(
            planning_company_id=grant.host_company_id,
            allow_partner_portal_owner=True,
        ),
    )
    return _reservation_response(db, reservation=reservation, current_user=current_user)


def delete_reservation(
    db: Session,
    *,
    grant: PartnerPortalGrant,
    current_user: User,
    reservation_id: int,
) -> None:
    require_company_planning(db, grant.host_company_id)
    _owned_reservation(db, grant, reservation_id)
    reservation_service.delete_reservation(
        db,
        current_user,
        reservation_id,
        access=ReservationMutationAccess(
            planning_company_id=grant.host_company_id,
            allow_partner_portal_owner=True,
        ),
    )


def overview(db: Session, *, grant: PartnerPortalGrant) -> dict:
    locations = list_locations(db, grant=grant)
    reservation_rows = reservation_repo.list_reservations(
        db,
        [location.id for location in locations],
        grant.partner_company_id,
    )
    owned_reservations = [
        reservation
        for reservation in reservation_rows
        if (
            reservation.owner_company_id == grant.partner_company_id
            and reservation.assigned_company_id == grant.host_company_id
        )
    ]
    pending_cleaning = sum(
        reservation.cleaning_required and reservation.service_request_sent_at is not None
        for reservation in owned_reservations
    )
    return {
        "host_company_id": grant.host_company_id,
        "host_company_name": grant.host_company.name,
        "partner_company_id": grant.partner_company_id,
        "partner_company_name": grant.partner_company.name,
        "location_count": len(locations),
        "upcoming_reservation_count": len(owned_reservations),
        "pending_cleaning_count": pending_cleaning,
    }
